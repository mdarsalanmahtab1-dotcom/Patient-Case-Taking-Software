"""
SwasthyaSync v4 — Dynamic Schema Generator (Stage 1)

Called ONCE per encounter, immediately after chief complaint + demographics.
Uses a heavy model (Gemini 3.6 Flash) to generate a complaint-specific
clinical interview schema.

Two-call strategy:
  1. Generate relevant categories (decide which sections matter for this complaint)
  2. Expand each included category into specific fields

The generated schema is then validated against the red-flag safety floor
to ensure all must-ask fields are present.
"""

from __future__ import annotations
import json
import logging
import time

import llm_client
from red_flag_library import get_safety_floor, get_safety_floor_as_text, merge_safety_floor

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Stage 1 Model — heavier model called once per encounter
# ──────────────────────────────────────────────────────────────────────
SCHEMA_MODEL_PRIMARY = "gemini-3.5-flash-lite"
SCHEMA_MODEL_FALLBACK = "gemini-3.6-flash"

# Language names for demographic context
LANGUAGE_NAMES = {
    "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu",
    "kn-IN": "Kannada", "bn-IN": "Bengali", "mr-IN": "Marathi",
    "gu-IN": "Gujarati", "ml-IN": "Malayalam", "pa-IN": "Punjabi",
    "or-IN": "Odia", "en-IN": "English",
}


def _build_schema_generation_prompt(
    chief_complaint: str,
    patient_age: int | None,
    patient_sex: str,
    category: str,
    safety_floor_text: str,
    doctor_custom_instructions: str | None = None,
) -> tuple[str, str]:
    """Build the system and user prompts for schema generation."""

    age_str = f"{patient_age} years old" if patient_age else "age unknown"
    sex_str = patient_sex or "unknown sex"
    
    doctor_instruction_text = ""
    if doctor_custom_instructions:
        doctor_instruction_text = f"\n\nCRITICAL DOCTOR INSTRUCTIONS:\nThe attending physician for this patient has provided the following custom intake instructions: \"{doctor_custom_instructions}\"\nYou MUST adjust your generated JSON schema to explicitly include fields that capture this specific information."

    system_prompt = f"""You are a senior clinical consultant designing a structured patient interview schema.

Your task: Given a patient's chief complaint and demographics, generate a detailed, complaint-specific JSON schema of fields that a medical interviewer should collect. This schema should mirror what an actual physician would ask based on the Macleod's Clinical Examination framework.{doctor_instruction_text}

CRITICAL RULES:
1. The schema must be HIGHLY SPECIFIC to the chief complaint. Do NOT include generic screening questions that are irrelevant (e.g., do NOT ask about family diabetes history for an isolated ankle sprain).
2. Include fields from these categories ONLY if clinically relevant:
   - HPI (History of Present Illness) — ALWAYS relevant
   - PMH (Past Medical History) — include only if relevant to the complaint
   - DH (Drug History / Allergies) — include if medications could be relevant
   - FH (Family History) — include only if hereditary factors matter
   - SH (Social History) — include only if lifestyle is relevant
   - ROS (Review of Systems) — targeted, not exhaustive
   - red_flag_check — ALWAYS include safety-critical screening questions
3. Each field should have a clear, natural question_intent (what we want to learn).
4. Assign priority: "critical" (must ask), "high" (should ask), "medium" (nice to have), "optional" (if time permits).
5. Mark red_flag: true for any field where a positive answer indicates a medical emergency.
6. Mark fork_eligible: true for fields where a POSITIVE/AFFIRMATIVE answer would need 1-2 targeted follow-up sub-questions. Examples:
   - "Do you have vision changes?" → if YES, fork: "Which eye?" + "When did it start?"
   - "Any previous surgeries?" → if YES, fork: "What surgery?" + "When?"
   Most fields should be fork_eligible: false. Only tag 3-5 fields max per schema.
7. Use conditional_on for fields that only matter given a previous answer (format: "field_id:value").
8. Generate 15-30 fields total — enough for a thorough but not exhausting interview.

The following fields are MANDATORY red-flag safety requirements for this complaint category. They MUST appear in your schema:
{safety_floor_text}

Output ONLY a JSON object with this exact structure:
{{
  "chief_complaint": "the complaint as understood",
  "fields": [
    {{
      "id": "unique_snake_case_id",
      "question_intent": "what this field is trying to learn, in plain language",
      "type": "string",
      "priority": "critical|high|medium|optional",
      "red_flag": true/false,
      "fork_eligible": true/false,
      "category": "HPI|PMH|DH|FH|SH|ROS|red_flag_check",
      "conditional_on": null
    }}
  ]
}}"""

    user_prompt = f"""Patient: {age_str}, {sex_str}
Chief Complaint: {chief_complaint}
Complaint Category: {category}

Generate the clinical interview schema for this specific patient and complaint. Remember:
- Be complaint-specific, not generic
- Include the mandatory safety floor fields listed in your instructions
{"- CRITICAL: You MUST include specific fields to capture the doctor's custom intake instructions." if doctor_custom_instructions else ""}
- Order fields by clinical priority (most important first within each category)"""

    return system_prompt, user_prompt


def generate_schema(
    chief_complaint: str,
    patient_age: int | None,
    patient_sex: str,
    category: str,
    doctor_custom_instructions: str | None = None,
) -> dict:
    """
    Generate a complaint-specific clinical interview schema.
    
    Called ONCE per encounter after chief complaint capture.
    Uses a heavier model for quality, with fallback to a static schema.
    
    Returns: A validated schema dict with "chief_complaint" and "fields" keys.
    """
    safety_floor_text = get_safety_floor_as_text(category)
    system_prompt, user_prompt = _build_schema_generation_prompt(
        chief_complaint, patient_age, patient_sex, category, safety_floor_text, doctor_custom_instructions
    )

    t0 = time.time()

    # Try the primary heavy model first
    schema = _call_model_for_schema(SCHEMA_MODEL_PRIMARY, system_prompt, user_prompt)

    # Fallback to lighter model if primary fails
    if schema is None:
        logger.warning(f"Primary schema model ({SCHEMA_MODEL_PRIMARY}) failed, trying fallback ({SCHEMA_MODEL_FALLBACK})")
        schema = _call_model_for_schema(SCHEMA_MODEL_FALLBACK, system_prompt, user_prompt)

    # Fallback to static schema if all LLM calls fail
    if schema is None:
        logger.error("All schema generation models failed — using static fallback schema")
        schema = _build_static_fallback(chief_complaint, category)

    # SAFETY: Merge the must-ask safety floor into the schema
    schema = merge_safety_floor(schema, category)

    # Validate and clean
    schema = _validate_schema(schema, chief_complaint)

    elapsed = time.time() - t0
    field_count = len(schema.get("fields", []))
    logger.info(f"Schema generation took {elapsed:.2f}s | {field_count} fields | category={category}")

    return schema


def _call_model_for_schema(model: str, system_prompt: str, user_prompt: str) -> dict | None:
    """Call a specific model for schema generation. Returns None on failure."""
    try:
        from google import genai
        from google.genai import types as genai_types
        import os

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=2048,
                automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        result = json.loads(response.text)

        # Basic validation
        if "fields" in result and isinstance(result["fields"], list):
            logger.info(f"Schema generated by {model}: {len(result['fields'])} fields")
            return result
        else:
            logger.warning(f"Schema from {model} missing 'fields' key")
            return None

    except Exception as e:
        logger.error(f"Schema generation with {model} failed: {e}")
        return None


def _build_static_fallback(chief_complaint: str, category: str) -> dict:
    """
    Build a static fallback schema from the red-flag library.
    Used when all LLM calls fail. Ensures the app never breaks.
    """
    safety_fields = get_safety_floor(category)
    
    # Add some universal baseline fields
    baseline = [
        {"id": "symptom_onset", "question_intent": "When did the problem start", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_duration", "question_intent": "How long has it been going on", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "symptom_severity_impact", "question_intent": "How much does it affect daily life", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "HPI", "conditional_on": None},
        {"id": "prior_episodes", "question_intent": "Has this happened before", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": True, "category": "HPI", "conditional_on": None},
        {"id": "current_medications", "question_intent": "Any medications currently being taken", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": False, "category": "DH", "conditional_on": None},
        {"id": "known_allergies", "question_intent": "Any known drug or food allergies", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": True, "category": "DH", "conditional_on": None},
        {"id": "chronic_conditions", "question_intent": "Any existing chronic health conditions (diabetes, hypertension, etc)", "type": "string", "priority": "medium", "red_flag": False, "fork_eligible": False, "category": "PMH", "conditional_on": None},
    ]

    # Merge baseline + safety floor, avoiding duplicates
    existing_ids = {f["id"] for f in safety_fields}
    all_fields = list(safety_fields)
    for f in baseline:
        if f["id"] not in existing_ids:
            all_fields.append(f)

    return {
        "chief_complaint": chief_complaint,
        "fields": all_fields,
    }


def _validate_schema(schema: dict, chief_complaint: str) -> dict:
    """Validate and clean the generated schema."""
    schema.setdefault("chief_complaint", chief_complaint)
    fields = schema.get("fields", [])

    # Ensure all fields have required keys
    valid_fields = []
    seen_ids = set()
    for f in fields:
        fid = f.get("id", "")
        if not fid or fid in seen_ids:
            continue
        seen_ids.add(fid)

        # Ensure defaults
        f.setdefault("question_intent", f.get("id", "").replace("_", " "))
        f.setdefault("type", "string")
        f.setdefault("priority", "medium")
        f.setdefault("red_flag", False)
        f.setdefault("fork_eligible", False)
        f.setdefault("category", "HPI")
        f.setdefault("conditional_on", None)

        # Validate priority
        if f["priority"] not in ("critical", "high", "medium", "optional"):
            f["priority"] = "medium"

        valid_fields.append(f)

    schema["fields"] = valid_fields
    return schema
