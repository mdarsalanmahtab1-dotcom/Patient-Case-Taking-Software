"""
SwasthyaSync v4 — Conversation Engine (Stage 2)

Two-step per-turn logic using the fast/cheap model:
  1. EXTRACTION: Given patient's message + unfilled fields → extract values
  2. QUESTION GENERATION: Given target field + context → one natural question

This replaces the old single-call approach with a more reliable pipeline.
"""

from __future__ import annotations
import json
import logging
import time

import llm_client
from fast_path_cache import get_cached_question

logger = logging.getLogger(__name__)

# Language names for prompt building
LANGUAGE_NAMES = {
    "hi-IN": "Hindi (हिन्दी)",
    "ta-IN": "Tamil (தமிழ்)",
    "te-IN": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "bn-IN": "Bengali (বাংলা)",
    "mr-IN": "Marathi (मराठी)",
    "gu-IN": "Gujarati (ગુજરાતી)",
    "ml-IN": "Malayalam (മലയാളം)",
    "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
    "or-IN": "Odia (ଓଡ଼ିଆ)",
    "en-IN": "English",
}


class ConversationResult:
    """Result from a single conversation turn."""

    def __init__(self, raw: dict):
        self.spoken_text: str = raw.get("spoken_text", "")
        self.suggested_options: list[dict] = raw.get("suggested_options", [])
        self.extracted_fields: dict = raw.get("extracted_fields", {})
        self.red_flag_check: str | None = raw.get("red_flag_check")
        self.reasoning: str = raw.get("reasoning", "")
        self.current_category: str = raw.get("current_category", "HPI")


# ──────────────────────────────────────────────────────────────────────
# STEP 1: EXTRACTION — extract field values from patient's message
# ──────────────────────────────────────────────────────────────────────

def extract_from_response(
    patient_message: str,
    unfilled_fields: list[dict],
    filled_summary: str,
    conversation_history: list[dict],
    language: str,
    doctor_custom_instructions: str | None = None,
) -> dict:
    """
    Given the patient's latest message and a list of unfilled fields,
    extract any field values the patient provided.
    
    Returns: {field_id: {"value": str, "confidence": float}}
    """
    if not patient_message.strip():
        return {}

    language_name = LANGUAGE_NAMES.get(language, "English")

    # Build a compact field list for the extraction prompt
    field_descriptions = []
    for f in unfilled_fields[:15]:  # Cap at 15 to keep extraction scoped and cheap
        field_descriptions.append(f"- {f['id']}: {f.get('question_intent', f['id'])}")
    fields_text = "\n".join(field_descriptions)

    # Last few messages for context
    recent_msgs = conversation_history[-4:] if conversation_history else []
    context_text = ""
    if recent_msgs:
        lines = []
        for m in recent_msgs:
            role = "Doctor" if m["role"] == "assistant" else "Patient"
            lines.append(f"{role}: {m['content']}")
        context_text = "\n".join(lines)

    system_prompt = f"""You are a medical data extraction engine.

    Given a patient's message (potentially in {language_name}), extract any clinical information that maps to the listed fields.
    {"The doctor requested you specifically look out for these details during extraction: " + doctor_custom_instructions if doctor_custom_instructions else ""}

    RULES:
    1. Only extract information that the patient CLEARLY stated. Do not infer or guess.
    2. If the patient's message doesn't contain information for a field, do NOT include that field.
    3. Values should be concise clinical summaries in English (for structured storage). Also include a "verbatim" key with the patient's approximate wording (translated to English if needed).
    4. Assign confidence: 0.9+ if clearly stated, 0.7-0.8 if somewhat clear, 0.5-0.6 if ambiguous.

    Output ONLY a JSON object:
    {{
      "extracted_fields": {{
        "field_id": {{"value": "clinical summary", "verbatim": "patient's exact words", "confidence": 0.9}},
        ...
      }}
    }}
    If nothing can be extracted, return: {{"extracted_fields": {{}}}}"""

    user_prompt = f"""=== FIELDS TO EXTRACT INTO ===
{fields_text}

=== RECENT CONVERSATION ===
{context_text}

=== PATIENT'S LATEST MESSAGE ===
{patient_message}

=== ALREADY KNOWN ===
{filled_summary}

Extract any field values from the patient's latest message."""

    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.1)
        extracted = result.get("extracted_fields", {})
        
        # Validate: only accept fields that are in our unfilled list
        valid_field_ids = {f["id"] for f in unfilled_fields}
        validated = {}
        for fid, entry in extracted.items():
            if fid in valid_field_ids and isinstance(entry, dict) and entry.get("value"):
                validated[fid] = entry
        
        logger.info(f"Extraction: {len(validated)} fields extracted from patient message")
        return validated

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return {}


# ──────────────────────────────────────────────────────────────────────
# STEP 1.5: FORK CHECK — generate sub-questions for significant answers
# ──────────────────────────────────────────────────────────────────────

# Deterministic negative-answer patterns — skips LLM call entirely
_NEGATIVE_PATTERNS = frozenset([
    "no", "none", "nahi", "nah", "nahin", "na", "denied", "denies",
    "nothing", "nil", "not applicable", "n/a", "no issues", "no problem",
    "koi nahi", "kuch nahi", "nope", "never", "not sure", "don't know",
    "healthy", "normal", "fine",
])

def _is_negative_answer(answer: str) -> bool:
    """Fast deterministic check — if True, skip the fork LLM call entirely."""
    clean = answer.strip().lower().rstrip(".!,")
    # Exact match
    if clean in _NEGATIVE_PATTERNS:
        return True
    # Starts with "no " or "no,"
    if clean.startswith(("no ", "no,", "none ", "nahi ", "nah ")):
        return True
    return False


def check_and_generate_fork_questions(
    parent_field: dict,
    patient_answer: str,
    chief_complaint: str,
    language: str,
    doctor_custom_instructions: str | None = None,
) -> list[dict] | None:
    """
    Given a fork_eligible field and the patient's answer, decide if a fork
    is warranted and generate 1-2 sub-question fields.

    OPTIMIZATIONS:
    - Deterministic negative-answer shortcircuit (no LLM call for "no"/"none")
    - Low temperature (0.1) to prevent hallucination
    - Bounded output tokens (512) for fast response
    
    Returns: list of sub-field dicts (same shape as schema fields) or None.
    """
    # SHORTCIRCUIT: Skip LLM entirely for clearly negative answers
    if _is_negative_answer(patient_answer):
        logger.info(f"Fork shortcircuit: negative answer for '{parent_field.get('id')}' — no LLM call")
        return None

    parent_id = parent_field.get("id", "unknown")
    parent_intent = parent_field.get("question_intent", "")
    parent_category = parent_field.get("category", "HPI")

    system_prompt = f"""You are a clinical interview sub-question generator.

A patient answered a question. You must decide if the answer is clinically significant enough to warrant 1-2 follow-up sub-questions.

RULES:
1. ONLY fork if the answer reveals something that NEEDS clarification (e.g., "yes I have allergies" → ask WHICH allergies).
2. Generate EXACTLY 1-2 sub-questions, no more. Keep them tightly scoped.
3. Sub-question IDs must be: "{parent_id}__<sub_name>" (double underscore).
4. Do NOT fork for vague or uninformative answers.
5. Sub-questions inherit the parent's category.
6. If the patient's answer conflates two clinically different scenarios (e.g., "takes supplements or retinoids" covers both self-treatment AND a drug side-effect), you MUST fork to disambiguate. Ask what the medication was prescribed FOR, even if they don't know the name.
7. If the parent question asked about family history and the patient said "yes", ALWAYS fork to ask: which relative, what condition, and at what age.

OUTPUT FORMAT — Return ONLY a JSON object:
If fork is warranted:
{{
  "fork": true,
  "sub_fields": [
    {{
      "id": "{parent_id}__<descriptive_sub_name>",
      "question_intent": "what this sub-question tries to learn",
      "type": "string",
      "priority": "high",
      "red_flag": false,
      "fork_eligible": false,
      "category": "{parent_category}",
      "conditional_on": null
    }}
  ]
}}

If fork is NOT warranted:
{{"fork": false, "sub_fields": []}}"""

    user_prompt = f"""Parent question: {parent_intent}
Patient's answer: "{patient_answer}"
Chief complaint: {chief_complaint}
{f"Doctor's instructions: {doctor_custom_instructions}" if doctor_custom_instructions else ""}

Should this answer be forked into sub-questions?"""

    t0 = time.time()
    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.1)
        elapsed = time.time() - t0

        if not result.get("fork", False):
            logger.info(f"Fork check for '{parent_id}': LLM said no fork ({elapsed:.2f}s)")
            return None

        sub_fields = result.get("sub_fields", [])
        if not sub_fields or not isinstance(sub_fields, list):
            return None

        # Validate and cap at 2 sub-fields
        validated = []
        for sf in sub_fields[:2]:
            if not isinstance(sf, dict) or not sf.get("id"):
                continue
            # Enforce namespacing
            if not sf["id"].startswith(f"{parent_id}__"):
                sf["id"] = f"{parent_id}__{sf['id']}"
            sf.setdefault("type", "string")
            sf.setdefault("priority", "high")
            sf.setdefault("red_flag", False)
            sf.setdefault("fork_eligible", False)
            sf.setdefault("category", parent_category)
            sf.setdefault("conditional_on", None)
            sf.setdefault("question_intent", sf["id"].replace("_", " "))
            validated.append(sf)

        if validated:
            logger.info(f"Fork triggered on '{parent_id}': {len(validated)} sub-fields generated ({elapsed:.2f}s)")
            return validated
        return None

    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Fork check failed for '{parent_id}' after {elapsed:.2f}s: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────
# STEP 2: QUESTION GENERATION — generate one natural question
# ──────────────────────────────────────────────────────────────────────

def generate_question(
    target_field: dict,
    filled_summary: str,
    conversation_history: list[dict],
    language: str,
    patient_message: str = "",
    chief_complaint: str = "",
    patient_age: int | None = None,
    patient_sex: str = "",
    previous_history: dict | None = None,
    doctor_custom_instructions: str | None = None,
) -> ConversationResult:
    """
    Generate one natural, conversational question for the target field.
    
    Also generates contextual suggested_options for the patient to tap.
    """
    language_name = LANGUAGE_NAMES.get(language, "English")
    field_id = target_field.get("id", "unknown")
    question_intent = target_field.get("question_intent", "")
    category = target_field.get("category", "HPI")
    is_red_flag = target_field.get("red_flag", False)

    # Fast-Path Cache Check (< 5ms response for common clinical intake fields)
    cached = get_cached_question(field_id, language)
    if cached:
        logger.info(f"⚡ Fast-Path Cache hit for field={field_id}, language={language}")
        return ConversationResult({
            "spoken_text": cached["spoken_text"],
            "suggested_options": cached["suggested_options"],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "Fast-Path cache hit (< 5ms)",
            "current_category": category,
        })

    # Last messages for context
    recent_msgs = conversation_history[-6:] if conversation_history else []
    context_text = ""
    if recent_msgs:
        lines = []
        for m in recent_msgs:
            role = "Doctor" if m["role"] == "assistant" else "Patient"
            lines.append(f"{role}: {m['content']}")
        context_text = "\n".join(lines)

    age_str = f"{patient_age} years old" if patient_age else ""
    sex_str = patient_sex or ""
    demo_str = f"Patient: {age_str} {sex_str}".strip()

    # Language instruction
    if language == "en-IN":
        lang_rule = "Respond in simple, clear English suitable for Indian patients."
    else:
        lang_rule = f"""CRITICAL LANGUAGE RULE:
- You MUST respond ENTIRELY in {language_name} using native script.
- spoken_text and all label_translated MUST be in {language_name}.
- Do NOT use English or Romanized text in spoken_text or label_translated.
- The label field in suggested_options should remain in English (for backend).
- The patient speaks {language_name}. Respond warmly in {language_name}."""

    system_prompt = f"""You are a compassionate medical kiosk assistant conducting a clinical history interview.

{lang_rule}

{demo_str}
Chief Complaint: {chief_complaint}
{"DOCTOR'S CUSTOM INSTRUCTIONS: " + doctor_custom_instructions if doctor_custom_instructions else ""}

YOUR TASK: Ask the patient about this specific clinical topic:
  Field: {field_id}
  Intent: {question_intent}
  Category: {category}
  {"⚠️ This is a RED FLAG safety question — ask it sensitively but clearly." if is_red_flag else ""}

CONVERSATION RULES:
1. Ask ONE question at a time — natural and conversational, NOT robotic.
2. If the patient just gave an answer, acknowledge it briefly before asking your next question.
3. Be warm and empathetic. Use simple language. No medical jargon.
4. Do NOT diagnose or suggest treatments. You are gathering information only.
5. Generate 3-6 contextually relevant suggested options the patient can tap.
6. Include a flexible option like "Something else" or "None of these".
7. Do NOT repeat any question the patient has already answered (check the conversation history and known information below).

OUTPUT FORMAT — Return ONLY a JSON object:
{{
  "spoken_text": "Your question in {language_name}",
  "suggested_options": [
    {{"label": "English label", "label_translated": "Label in {language_name}"}},
    ...
  ],
  "reasoning": "Brief internal reasoning (English, not shown to patient)"
}}"""

    user_prompt = f"""=== ALREADY KNOWN INFORMATION ===
{filled_summary}

=== CONVERSATION SO FAR ===
{context_text}

{f"=== PAST MEDICAL CONTEXT (FOLLOW-UP VISIT) ==={chr(10)}The patient visited on {previous_history.get('completed_at', 'an earlier date')}.{chr(10)}Chief Complaint: {previous_history.get('chief_complaint')}{chr(10)}Diagnosis: {previous_history.get('small_summary')}{chr(10)}Prescription: {previous_history.get('doctor_prescription')}{chr(10)}Use this context to inform your questions if relevant, but stay focused on the current target field." if previous_history else ""}

{"=== PATIENT'S LAST MESSAGE ===" + chr(10) + patient_message if patient_message else "This is the opening question. No patient message yet."}

Generate your question about: {question_intent}"""

    t0 = time.time()
    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.4)
        elapsed = time.time() - t0

        spoken_text = result.get("spoken_text", "")
        options = result.get("suggested_options", [])
        reasoning = result.get("reasoning", "")

        if not spoken_text:
            spoken_text = _fallback_question(question_intent, language_name)
        if not options:
            options = _fallback_options(language_name)

        logger.info(f"Question generation took {elapsed:.2f}s | field={field_id} | category={category}")

        return ConversationResult({
            "spoken_text": spoken_text,
            "suggested_options": options,
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": reasoning,
            "current_category": category,
        })

    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Question generation failed after {elapsed:.2f}s: {e}")
        return ConversationResult({
            "spoken_text": _fallback_question(question_intent, language_name),
            "suggested_options": _fallback_options(language_name),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": f"Fallback — error: {e}",
            "current_category": category,
        })


# ──────────────────────────────────────────────────────────────────────
# OPENING QUESTION — for the very first turn (chief complaint)
# ──────────────────────────────────────────────────────────────────────

def generate_opening_question(
    language: str,
    patient_name: str = "",
    patient_age: int | None = None,
    patient_sex: str = "",
    previous_history: dict | None = None,
    doctor_custom_instructions: str | None = None,
) -> ConversationResult:
    """Generate the opening chief complaint question."""
    language_name = LANGUAGE_NAMES.get(language, "English")

    name_str = f" {patient_name}" if patient_name else ""
    
    if language == "en-IN":
        lang_rule = "Respond in simple, clear English."
    else:
        lang_rule = f"You MUST respond ENTIRELY in {language_name} using native script. spoken_text and label_translated must be in {language_name}."

    follow_up_prompt = ""
    if previous_history:
        follow_up_prompt = f"""
This is a FOLLOW-UP VISIT. The patient was here on {previous_history.get('completed_at')}.
Previous diagnosis: {previous_history.get('small_summary')}
Previous treatment: {previous_history.get('doctor_prescription')}
Instead of a generic "what brings you here", ask how they are doing since their last visit regarding this issue, or if there is a new problem.
"""

    system_prompt = f"""You are a compassionate medical kiosk assistant.
{lang_rule}

Generate a warm opening question to ask the patient what brings them here today.
{"Address them as " + name_str + "." if name_str else ""}
{follow_up_prompt}
{"DOCTOR'S CUSTOM INSTRUCTIONS FOR INTERVIEW: " + doctor_custom_instructions if doctor_custom_instructions else ""}

OUTPUT FORMAT — Return ONLY a JSON object:
{{
  "spoken_text": "Your warm greeting and opening question in {language_name}",
  "suggested_options": [
    {{"label": "English label", "label_translated": "Label in {language_name}"}},
    ...
  ]
}}

Include 5-8 common complaint options like: Fever, Pain, Cough, Stomach problem, Weakness, Skin issue, Breathing difficulty, Something else."""

    user_prompt = f"Generate the opening question for the patient interview."

    try:
        result = llm_client.conversation_turn(system_prompt, user_prompt, temperature=0.3)
        return ConversationResult({
            "spoken_text": result.get("spoken_text", "What brings you here today?"),
            "suggested_options": result.get("suggested_options", _fallback_options(language_name)),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "",
            "current_category": "CHIEF_COMPLAINT",
        })
    except Exception as e:
        logger.error(f"Opening question generation failed: {e}")
        return ConversationResult({
            "spoken_text": "What brings you here today?",
            "suggested_options": _fallback_options(language_name),
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": f"Fallback: {e}",
            "current_category": "CHIEF_COMPLAINT",
        })


# ──────────────────────────────────────────────────────────────────────
# CLOSING — generate a summary confirmation message
# ──────────────────────────────────────────────────────────────────────

def generate_closing(language: str, filled_summary: str) -> ConversationResult:
    """Generate a closing message summarizing what was collected."""
    language_name = LANGUAGE_NAMES.get(language, "English")

    if language == "en-IN":
        lang_rule = "Respond in English."
    else:
        lang_rule = f"Respond ENTIRELY in {language_name} using native script."

    system_prompt = f"""You are a compassionate medical kiosk assistant.
{lang_rule}
The interview is complete. Thank the patient and let them know their information will be shared with the doctor.
Keep it brief (1-2 sentences).

OUTPUT FORMAT — Return ONLY: {{"spoken_text": "your closing message"}}"""

    try:
        result = llm_client.conversation_turn(system_prompt, filled_summary, temperature=0.2)
        return ConversationResult({
            "spoken_text": result.get("spoken_text", "Thank you. Your doctor will review this information."),
            "suggested_options": [],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "",
            "current_category": "COMPLETE",
        })
    except Exception:
        return ConversationResult({
            "spoken_text": "Thank you. Your doctor will review this information.",
            "suggested_options": [],
            "extracted_fields": {},
            "red_flag_check": None,
            "reasoning": "Fallback",
            "current_category": "COMPLETE",
        })


# ──────────────────────────────────────────────────────────────────────
# FALLBACKS
# ──────────────────────────────────────────────────────────────────────

def _fallback_question(intent: str, language_name: str) -> str:
    return f"Can you tell me about: {intent}?"


def _fallback_options(language_name: str) -> list[dict]:
    return [
        {"label": "Yes", "label_translated": "Yes"},
        {"label": "No", "label_translated": "No"},
        {"label": "Not sure", "label_translated": "Not sure"},
        {"label": "Something else", "label_translated": "Something else"},
    ]
