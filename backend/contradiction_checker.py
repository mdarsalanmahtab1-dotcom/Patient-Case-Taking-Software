"""
SwasthyaSync — Conversation ↔ Document Contradiction Checker

Runs at the Screen 6 confirmation step — the FIRST moment both the filled_state
(from conversation) and document_extractions (from OCR) exist together.

Strategy: simple field-matching for hackathon scope.
  - "current medications" conversational slots  ⇔  Medication entities
  - "known conditions" conversational slots     ⇔  Diagnosis entities
  - "surgical history" conversational slots      ⇔  surgical_history entities

Output: list of Contradiction dicts, NEVER auto-resolved — the whole point is to
flag them for the physician.  Status is always "unresolved".
"""

from __future__ import annotations
import logging
from patient_record import Contradiction

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Field-matching helpers
# ──────────────────────────────────────────────────────────────────────

def _normalize(val: str) -> str:
    """Lowercase, strip whitespace, collapse separators for fuzzy matching."""
    return " ".join(str(val).lower().strip().split())


def _values_conflict(conv_val: str, doc_val: str) -> bool:
    """
    True when two values are both non-empty AND don't share enough tokens
    to be considered a match.  Deliberately conservative: if >50 % of the
    shorter string's tokens appear in the longer one we call it a match.
    """
    a = set(_normalize(conv_val).split())
    b = set(_normalize(doc_val).split())
    if not a or not b:
        return False  # One side is empty — not a contradiction
    overlap = a & b
    shorter = min(len(a), len(b))
    return len(overlap) / shorter < 0.5   # less than half overlap → conflict


# ──────────────────────────────────────────────────────────────────────
# Core API
# ──────────────────────────────────────────────────────────────────────

# Field IDs in filled_state that map to medication / diagnosis / surgery slots.
# These are the dynamic-schema field IDs produced by Stage 1.
_MEDICATION_FIELD_IDS = {
    "current_medications", "medications", "drug_history",
    "ongoing_medications", "current_drugs", "regular_medications",
}

_DIAGNOSIS_FIELD_IDS = {
    "known_conditions", "past_medical_history", "chronic_conditions",
    "diagnosed_conditions", "pmh", "medical_history", "comorbidities",
}

_SURGERY_FIELD_IDS = {
    "surgical_history", "past_surgeries", "operations", "procedures",
}


def check_contradictions(
    filled_state: dict,
    document_extractions: list[dict],
) -> list[dict]:
    """
    Compare conversational filled_state against document extraction entities.

    Parameters
    ----------
    filled_state : dict
        {field_id: {"value": ..., "confidence": float}}  from PatientRecord.filled_state
    document_extractions : list[dict]
        Each dict is a DocumentExtraction.model_dump().  The actual Gemini-extracted
        entities live inside  extraction["entities"][i] (a DigitizedDocument dict).

    Returns
    -------
    list[dict]
        Each item: {"field", "conversation_value", "document_value", "status": "unresolved"}
    """
    contradictions: list[dict] = []

    # Flatten all entity dicts from every extraction
    all_entities: list[dict] = []
    for ext in document_extractions:
        for ent in ext.get("entities", []):
            all_entities.append(ent)

    if not all_entities:
        return contradictions

    # Collect document-side medication names
    doc_med_names: list[str] = []
    for ent in all_entities:
        for med in ent.get("medications", []):
            name = med.get("drug_name") or med.get("name") or ""
            if name:
                doc_med_names.append(_normalize(name))

    # Collect document-side diagnosis names
    doc_dx_names: list[str] = []
    for ent in all_entities:
        for dx in ent.get("diagnoses", []):
            name = dx.get("condition_name") or dx.get("name") or ""
            if name:
                doc_dx_names.append(_normalize(name))

    # Collect document-side surgical history
    doc_surg: list[str] = []
    for ent in all_entities:
        for s in ent.get("surgical_history", []):
            if s:
                doc_surg.append(_normalize(str(s)))

    # Check each conversational slot against document entities
    for field_id, entry in filled_state.items():
        if not isinstance(entry, dict):
            continue
        conv_val = str(entry.get("value", "")).strip()
        if not conv_val:
            continue
        fid = field_id.lower()

        # Medication check
        if any(kw in fid for kw in _MEDICATION_FIELD_IDS) and doc_med_names:
            doc_joined = ", ".join(doc_med_names)
            if _values_conflict(conv_val, doc_joined):
                contradictions.append({
                    "field": field_id,
                    "conversation_value": conv_val,
                    "document_value": doc_joined,
                    "status": "unresolved",
                })

        # Diagnosis check
        if any(kw in fid for kw in _DIAGNOSIS_FIELD_IDS) and doc_dx_names:
            doc_joined = ", ".join(doc_dx_names)
            if _values_conflict(conv_val, doc_joined):
                contradictions.append({
                    "field": field_id,
                    "conversation_value": conv_val,
                    "document_value": doc_joined,
                    "status": "unresolved",
                })

        # Surgical history check
        if any(kw in fid for kw in _SURGERY_FIELD_IDS) and doc_surg:
            doc_joined = ", ".join(doc_surg)
            if _values_conflict(conv_val, doc_joined):
                contradictions.append({
                    "field": field_id,
                    "conversation_value": conv_val,
                    "document_value": doc_joined,
                    "status": "unresolved",
                })

    if contradictions:
        logger.warning(f"⚠️  Contradiction checker found {len(contradictions)} conflicts")
    else:
        logger.info("✅ Contradiction checker: no conflicts between conversation and documents")

    return contradictions
