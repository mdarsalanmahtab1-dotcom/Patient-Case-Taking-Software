"""
SwasthyaSync v4 — Complaint Qualifier

Solves the "pain with no location" problem.

Some chief complaints are inherently vague — they are CATEGORY words,
not specific descriptions. When a patient says just "pain", "fever", or
"swelling", we do NOT know enough to generate a useful schema yet.

The schema generator will hallucinate a type (usually musculoskeletal
for "pain"), generate all questions around that assumed type, and then
ask the location field 3-4 turns in — by which time all the preceding
questions were wrong.

ARCHITECTURE:
  Before schema generation, if the chief complaint is vague, the
  Dialogue Manager asks ONE critical qualifying question. The answer is
  appended to the complaint string. Schema generation then receives
  "pain in the chest" (specific) instead of "pain" (vague).

  This qualification turn happens INSIDE the CHIEF_COMPLAINT FSM state
  (not a new state), so the FSM remains unchanged.

QUALIFIER MAP:
  Each entry defines:
  - keywords: complaint words that trigger this qualifier
  - question: the single question to ask (in English; translated at call site)
  - options: tap options for the patient
  - field_hint: what this answer tells us (used to build enriched complaint)
"""

from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Qualifier definitions
# ──────────────────────────────────────────────────────────────────────

QUALIFIERS: list[dict] = [
    {
        "id": "pain_location",
        "keywords": [
            "pain", "ache", "hurt", "hurting", "sore", "dard", "dard hai",
            "dard ho raha", "takleef", "discomfort", "burning", "cramp",
        ],
        "question": "I see you're having pain. Can you tell me — where exactly is the pain?",
        "options": [
            {"label": "Chest", "label_translated": "Chest"},
            {"label": "Abdomen / Stomach", "label_translated": "Abdomen / Stomach"},
            {"label": "Head / Neck", "label_translated": "Head / Neck"},
            {"label": "Back", "label_translated": "Back"},
            {"label": "Arm / Shoulder", "label_translated": "Arm / Shoulder"},
            {"label": "Leg / Knee / Foot", "label_translated": "Leg / Knee / Foot"},
            {"label": "Joint (Hip, Knee, Ankle)", "label_translated": "Joint (Hip, Knee, Ankle)"},
            {"label": "Somewhere else", "label_translated": "Somewhere else"},
        ],
        "enrichment_template": "pain in the {answer}",
    },
    {
        "id": "fever_duration",
        "keywords": ["fever", "temperature", "bukhar", "bukhaar", "pyrexia"],
        "question": "You have fever — how long have you had it?",
        "options": [
            {"label": "Started today", "label_translated": "Started today"},
            {"label": "1-2 days", "label_translated": "1-2 days"},
            {"label": "3-5 days", "label_translated": "3-5 days"},
            {"label": "More than a week", "label_translated": "More than a week"},
        ],
        "enrichment_template": "fever for {answer}",
    },
    {
        "id": "swelling_location",
        "keywords": ["swelling", "swell", "swollen", "bloating", "sujan", "soojan"],
        "question": "Where is the swelling?",
        "options": [
            {"label": "Face / Eyes", "label_translated": "Face / Eyes"},
            {"label": "Neck", "label_translated": "Neck"},
            {"label": "Abdomen", "label_translated": "Abdomen"},
            {"label": "Legs / Feet / Ankles", "label_translated": "Legs / Feet / Ankles"},
            {"label": "Arms / Hands", "label_translated": "Arms / Hands"},
            {"label": "Joints", "label_translated": "Joints"},
            {"label": "Somewhere else", "label_translated": "Somewhere else"},
        ],
        "enrichment_template": "swelling in the {answer}",
    },
    {
        "id": "weakness_type",
        "keywords": ["weakness", "weak", "fatigue", "tired", "kamzori", "thakaan", "thakawat"],
        "question": "Can you tell me more about the weakness — is it all over your body, or in a specific part?",
        "options": [
            {"label": "All over (general fatigue)", "label_translated": "All over (general fatigue)"},
            {"label": "One arm or leg (one side)", "label_translated": "One arm or leg (one side)"},
            {"label": "Both legs", "label_translated": "Both legs"},
            {"label": "Arms / Grip weakness", "label_translated": "Arms / Grip weakness"},
            {"label": "I feel breathless / low energy", "label_translated": "I feel breathless / low energy"},
        ],
        "enrichment_template": "weakness — {answer}",
    },
]

# Build a fast lookup: lowercased keyword → qualifier
_KEYWORD_INDEX: dict[str, dict] = {}
for _q in QUALIFIERS:
    for _kw in _q["keywords"]:
        _KEYWORD_INDEX[_kw.lower()] = _q


# ──────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────

def needs_qualification(chief_complaint: str) -> dict | None:
    """
    Check if a chief complaint is too vague to generate a good schema.

    Returns the matching qualifier dict if qualification is needed,
    or None if the complaint is already specific enough.

    A complaint is vague if:
    1. It matches a qualifier keyword AND
    2. It is short (≤ 5 words) AND
    3. It does NOT already contain a location/qualifier word

    Examples:
      "pain"                         → vague, needs qualification
      "pain in chest"                → specific (location word present), no qualification
      "chest pain since morning"     → specific (location word present), no qualification
      "I have been having chest pain"→ specific (> 5 words + location word), no qualification
      "I have pain"                  → short but no location — needs qualification
    """
    complaint_lower = chief_complaint.lower().strip()
    words = complaint_lower.split()

    # Words that indicate the complaint is already location-specific
    LOCATION_INDICATORS = {
        "chest", "heart", "stomach", "abdominal", "abdomen", "head", "neck",
        "back", "arm", "leg", "knee", "ankle", "foot", "shoulder", "hip",
        "joint", "throat", "ear", "eye", "tooth", "teeth", "jaw", "wrist",
        "hand", "finger", "toe", "groin", "pelvis", "side", "left", "right",
        "seena", "pet", "sar", "sir", "kamar", "peeth", "ghutna", "pair",
        "haath", "baazu", "gala", "kamar", "peet",
    }

    # If complaint already contains a location word, it's specific enough
    if any(loc in complaint_lower for loc in LOCATION_INDICATORS):
        logger.info(f"Complaint '{chief_complaint}' has location word — skipping qualification")
        return None

    # If the complaint is long (> 5 words), the patient is describing something specific
    if len(words) > 5:
        logger.info(f"Complaint '{chief_complaint}' is detailed enough — skipping qualification")
        return None

    # Check each keyword
    for keyword, qualifier in _KEYWORD_INDEX.items():
        if keyword in complaint_lower:
            logger.info(f"Complaint '{chief_complaint}' is vague — needs qualification on: {qualifier['id']}")
            return qualifier

    return None


def build_enriched_complaint(original_complaint: str, qualifier: dict, qualifier_answer: str) -> str:
    """
    Build an enriched chief complaint string by combining the original
    vague complaint with the qualifying answer.

    E.g.: original="pain", qualifier_answer="chest"
          → "pain in the Chest"

    The enriched string is then used as input to schema generation,
    giving the LLM full context to generate the right schema.
    """
    template = qualifier.get("enrichment_template", "{answer}")
    enriched = template.format(answer=qualifier_answer)

    # If original already contains the enriched info, don't duplicate
    if qualifier_answer.lower() in original_complaint.lower():
        return original_complaint

    return enriched
