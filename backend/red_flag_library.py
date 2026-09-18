"""
SwasthyaSync v4 — Red-Flag Reference Library

A curated, complaint-category-indexed library of:
  1. Must-ask red-flag fields (injected into Stage 1 schema generation as grounding)
  2. Critical detection rules (run against filled_state after every update)

This is the NON-NEGOTIABLE safety floor that operates independently of the LLM layer.
"""

from __future__ import annotations
from patient_record import RedFlagEntry


# ──────────────────────────────────────────────────────────────────────
# MUST-ASK RED-FLAG FIELDS per complaint category
# These are injected into Stage 1 schema generation as grounding context
# so the LLM elaborates ON TOP of this floor, never from scratch.
# ──────────────────────────────────────────────────────────────────────

MUST_ASK_FIELDS: dict[str, list[dict]] = {
    "pain": [
        {"id": "pain_location", "question_intent": "Exact anatomical location of the pain", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "pain_severity", "question_intent": "Severity on a 1-10 scale", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "pain_radiation", "question_intent": "Does pain radiate to arm, jaw, back, or elsewhere", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "pain_onset", "question_intent": "When did the pain start and was it sudden or gradual", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "pain_character", "question_intent": "Quality of pain: sharp, dull, burning, crushing, cramping", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "associated_sweating", "question_intent": "Is the pain accompanied by sweating, nausea, or breathlessness", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "weight_bearing", "question_intent": "Can the patient bear weight (for limb/joint pain)", "type": "string", "priority": "high", "red_flag": True, "category": "red_flag_check"},
    ],
    "cardiac": [
        {"id": "chest_pain_location", "question_intent": "Exact location of chest discomfort", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "chest_pain_radiation", "question_intent": "Radiation to left arm, jaw, back, or neck", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "chest_pain_character", "question_intent": "Quality: crushing, squeezing, pressure, tightness", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "associated_sweating_nausea", "question_intent": "Diaphoresis, nausea, vomiting with chest pain", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "breathlessness_at_rest", "question_intent": "Dyspnea at rest or on minimal exertion", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "syncope_presyncope", "question_intent": "Fainting or near-fainting episodes", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "palpitations", "question_intent": "Awareness of abnormal heartbeat", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
    ],
    "fever": [
        {"id": "fever_duration", "question_intent": "Duration of fever in days", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "fever_pattern", "question_intent": "Continuous, intermittent, or remittent pattern", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "fever_peak_temp", "question_intent": "Highest recorded temperature", "type": "string", "priority": "high", "red_flag": True, "category": "HPI"},
        {"id": "rigors", "question_intent": "Severe shaking chills (rigors)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "rash_with_fever", "question_intent": "Any rash accompanying fever", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "neck_stiffness", "question_intent": "Neck stiffness or photophobia (meningeal signs)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "travel_exposure", "question_intent": "Recent travel or contact with sick individuals", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
    ],
    "respiratory": [
        {"id": "cough_duration", "question_intent": "How long the cough/breathing difficulty has lasted", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "sputum_character", "question_intent": "Sputum color: clear, yellow/green, blood-tinged", "type": "string", "priority": "high", "red_flag": True, "category": "HPI"},
        {"id": "hemoptysis", "question_intent": "Coughing up blood", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "breathlessness_severity", "question_intent": "At rest, on exertion, cannot lie flat, cannot speak in sentences", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "wheeze", "question_intent": "Audible wheezing or whistling sound", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "chest_pain_with_breathing", "question_intent": "Pleuritic chest pain worsening on deep breathing", "type": "string", "priority": "high", "red_flag": True, "category": "HPI"},
    ],
    "gi": [
        {"id": "abdominal_pain_location", "question_intent": "Exact location of abdominal pain", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "bowel_habit_change", "question_intent": "Change in bowel habits: diarrhea, constipation, alternating", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "blood_in_stool", "question_intent": "Blood in stool: fresh red, dark/tarry (melena)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "blood_in_vomit", "question_intent": "Hematemesis: fresh blood or coffee-ground vomit", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "unintentional_weight_loss", "question_intent": "Unexplained weight loss over weeks/months", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "appetite_change", "question_intent": "Appetite increase, decrease, or anorexia", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "abdominal_distension", "question_intent": "Bloating or visible swelling of abdomen", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
    ],
    "neuro": [
        {"id": "headache_onset", "question_intent": "Sudden thunderclap onset vs gradual", "type": "string", "priority": "critical", "red_flag": True, "category": "HPI"},
        {"id": "worst_headache_ever", "question_intent": "Is this the worst headache of their life", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "focal_neurological_deficit", "question_intent": "Weakness, numbness, or tingling on one side", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "speech_difficulty", "question_intent": "Slurred speech or difficulty finding words", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "vision_changes", "question_intent": "Sudden vision loss, double vision, visual field defects", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "seizures", "question_intent": "Seizure episodes: type, duration, frequency", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "neck_stiffness", "question_intent": "Neck stiffness (meningeal signs)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "consciousness_level", "question_intent": "Any loss of consciousness or altered mental state", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
    ],
    "musculoskeletal": [
        {"id": "joint_pain_location", "question_intent": "Which joints are affected", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "trauma_history", "question_intent": "Any recent injury or trauma", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "weight_bearing_ability", "question_intent": "Can the patient walk/bear weight (Ottawa Ankle/Knee Rules)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "point_tenderness", "question_intent": "Point tenderness over bony prominences (fracture sign)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "swelling_deformity", "question_intent": "Visible swelling, deformity, or bruising", "type": "string", "priority": "high", "red_flag": True, "category": "HPI"},
        {"id": "range_of_motion", "question_intent": "Ability to move the affected joint/limb", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "morning_stiffness", "question_intent": "Morning stiffness duration (inflammatory vs mechanical)", "type": "string", "priority": "medium", "red_flag": False, "category": "HPI"},
    ],
    "skin": [
        {"id": "rash_distribution", "question_intent": "Location and spread of skin lesion/rash", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "rash_onset", "question_intent": "When the rash/lesion first appeared", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "rash_progression", "question_intent": "Is it spreading, changing, or stable", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "associated_fever", "question_intent": "Fever accompanying the skin problem", "type": "string", "priority": "high", "red_flag": True, "category": "red_flag_check"},
        {"id": "itching_pain", "question_intent": "Itching, pain, or tenderness of the lesion", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
    ],
    "urinary": [
        {"id": "urinary_symptoms", "question_intent": "Dysuria, frequency, urgency, hesitancy", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "hematuria", "question_intent": "Blood in urine", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "flank_pain", "question_intent": "Pain in the flanks or lower back (renal colic)", "type": "string", "priority": "high", "red_flag": True, "category": "HPI"},
        {"id": "fever_with_urinary", "question_intent": "Fever with urinary symptoms (pyelonephritis)", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
        {"id": "urinary_retention", "question_intent": "Inability to pass urine", "type": "string", "priority": "critical", "red_flag": True, "category": "red_flag_check"},
    ],
    # General fallback for unclassified complaints
    "general": [
        {"id": "symptom_duration", "question_intent": "How long the main symptom has been present", "type": "string", "priority": "critical", "red_flag": False, "category": "HPI"},
        {"id": "symptom_progression", "question_intent": "Getting worse, stable, or improving", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "symptom_severity", "question_intent": "Impact on daily activities", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
        {"id": "unintentional_weight_loss", "question_intent": "Unexplained weight loss", "type": "string", "priority": "high", "red_flag": True, "category": "red_flag_check"},
        {"id": "night_sweats", "question_intent": "Night sweats (TB/malignancy screen)", "type": "string", "priority": "high", "red_flag": True, "category": "red_flag_check"},
        {"id": "fever_present", "question_intent": "Presence of fever", "type": "string", "priority": "high", "red_flag": False, "category": "HPI"},
    ],
    "eye": [
        {"id": "vision_change_onset", "question_intent": "When did the vision change start and was it sudden or gradual", "type": "string", "priority": "critical", "red_flag": True, "fork_eligible": False, "category": "HPI"},
        {"id": "which_eye_affected", "question_intent": "Which eye is affected — one eye, both, or alternating", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": True, "category": "HPI"},
        {"id": "peripheral_tunnel_vision", "question_intent": "Any loss of side vision, tunnel vision, or bumping into things", "type": "string", "priority": "critical", "red_flag": True, "fork_eligible": True, "category": "HPI"},
        {"id": "night_vision_difficulty", "question_intent": "Difficulty seeing in dim light or at night (nyctalopia)", "type": "string", "priority": "critical", "red_flag": False, "fork_eligible": True, "category": "HPI"},
        {"id": "eye_pain_redness", "question_intent": "Eye pain, redness, or discharge", "type": "string", "priority": "high", "red_flag": True, "fork_eligible": False, "category": "red_flag_check"},
        {"id": "corneal_signs", "question_intent": "Dry eyes, gritty feeling, or white spots on the eye (Bitot spots / xerophthalmia signs)", "type": "string", "priority": "critical", "red_flag": True, "fork_eligible": True, "category": "red_flag_check"},
        {"id": "family_eye_disease", "question_intent": "Family history of eye disease (glaucoma, retinitis pigmentosa, macular degeneration)", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": True, "category": "FH"},
        {"id": "current_eye_medications", "question_intent": "Any current eye drops, vitamin A supplements, or retinoid medications", "type": "string", "priority": "high", "red_flag": False, "fork_eligible": True, "category": "DH"},
        {"id": "sudden_vision_loss", "question_intent": "Sudden complete vision loss in one or both eyes", "type": "string", "priority": "critical", "red_flag": True, "fork_eligible": False, "category": "red_flag_check"},
    ],
}

# Also cover less common categories with general fallback
for _cat in ["gynecological", "psychiatric", "ent"]:
    if _cat not in MUST_ASK_FIELDS:
        MUST_ASK_FIELDS[_cat] = list(MUST_ASK_FIELDS["general"])


def get_safety_floor(category: str) -> list[dict]:
    """Return the must-ask red-flag fields for a complaint category."""
    return MUST_ASK_FIELDS.get(category, MUST_ASK_FIELDS["general"])


def get_safety_floor_as_text(category: str) -> str:
    """Return the must-ask fields formatted as text for LLM grounding."""
    fields = get_safety_floor(category)
    lines = []
    for f in fields:
        flag_marker = " [RED FLAG]" if f.get("red_flag") else ""
        lines.append(f"- {f['id']} ({f['priority']}){flag_marker}: {f['question_intent']}")
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────
# RULE-BASED SAFETY NET — runs against filled_state after every update
# These are deterministic, auditable, and NEVER dependent on LLM output.
# ──────────────────────────────────────────────────────────────────────

def _val(filled_state: dict, field_id: str) -> str:
    """Safely get a lowercase string value from filled_state."""
    entry = filled_state.get(field_id, {})
    v = entry.get("value", "") if isinstance(entry, dict) else ""
    return str(v).lower().strip()


def _has(filled_state: dict, field_id: str, keywords: list[str]) -> bool:
    """Check if a field value contains any of the keywords."""
    val = _val(filled_state, field_id)
    return any(kw in val for kw in keywords)


SAFETY_RULES: list[dict] = [
    {
        "id": "CARDIAC_ACS",
        "description": "Possible Acute Coronary Syndrome — chest pain with radiation/sweating/breathlessness",
        "check": lambda fs: (
            _has(fs, "chest_pain_location", ["chest", "seena", "chhati"]) or
            _has(fs, "pain_location", ["chest", "seena", "chhati"])
        ) and (
            _has(fs, "chest_pain_radiation", ["arm", "jaw", "back", "neck", "baazu", "jabda"]) or
            _has(fs, "pain_radiation", ["arm", "jaw", "back", "neck"]) or
            _has(fs, "associated_sweating_nausea", ["sweat", "nausea", "vomit", "pasina"]) or
            _has(fs, "associated_sweating", ["sweat", "nausea", "breathless", "saans"])
        ),
    },
    {
        "id": "STROKE_FAST",
        "description": "Possible Stroke — FAST symptoms (face drooping, arm weakness, speech difficulty)",
        "check": lambda fs: (
            _has(fs, "focal_neurological_deficit", ["weakness", "numb", "one side", "ek taraf"]) or
            _has(fs, "speech_difficulty", ["slur", "cannot speak", "difficulty", "bol nahi"])
        ),
    },
    {
        "id": "SEVERE_RESPIRATORY_DISTRESS",
        "description": "Severe respiratory distress — breathlessness at rest or cannot lie flat",
        "check": lambda fs: (
            _has(fs, "breathlessness_severity", ["at rest", "cannot lie", "sentence", "cannot speak"]) or
            _has(fs, "breathlessness_at_rest", ["yes", "at rest", "cannot lie", "haan"])
        ),
    },
    {
        "id": "SIGNIFICANT_HEMOPTYSIS",
        "description": "Significant hemoptysis — urgent evaluation needed",
        "check": lambda fs: _has(fs, "hemoptysis", ["significant", "large", "yes", "haan"]),
    },
    {
        "id": "GI_HEMORRHAGE",
        "description": "GI hemorrhage — blood in stool or vomit",
        "check": lambda fs: (
            _has(fs, "blood_in_stool", ["yes", "fresh", "dark", "tarry", "melena", "haan"]) or
            _has(fs, "blood_in_vomit", ["yes", "blood", "coffee", "haan"])
        ),
    },
    {
        "id": "MENINGITIS_SUSPECT",
        "description": "Possible meningitis — fever + headache + neck stiffness",
        "check": lambda fs: (
            _has(fs, "neck_stiffness", ["yes", "stiff", "haan"]) and (
                _has(fs, "fever_present", ["yes", "haan"]) or
                _has(fs, "rash_with_fever", ["yes", "haan"])
            )
        ),
    },
    {
        "id": "FRACTURE_SUSPECT",
        "description": "Possible fracture — unable to bear weight + point tenderness over bone",
        "check": lambda fs: (
            _has(fs, "weight_bearing_ability", ["cannot", "unable", "no", "nahi"]) and
            _has(fs, "point_tenderness", ["yes", "tender", "haan"])
        ),
    },
    {
        "id": "SUICIDAL_IDEATION",
        "description": "Suicidal ideation detected — immediate mental health referral needed",
        "check": lambda fs: _has(fs, "suicidal_ideation", ["yes", "thinking", "plan", "haan", "soch"]),
    },
    {
        "id": "URINARY_RETENTION",
        "description": "Acute urinary retention — unable to pass urine",
        "check": lambda fs: _has(fs, "urinary_retention", ["yes", "cannot", "unable", "nahi"]),
    },
    {
        "id": "CORNEAL_KERATOMALACIA_RISK",
        "description": "Possible corneal involvement / keratomalacia — night blindness + dry eyes + fever suggests acute vitamin A deficiency decompensation. Urgent ophthalmology referral recommended.",
        "check": lambda fs: (
            _has(fs, "night_vision_difficulty", ["yes", "difficulty", "cannot see", "haan", "nahi dikh"])
            and _has(fs, "corneal_signs", ["dry", "gritty", "spots", "white", "sookha", "yes", "haan"])
            and (
                _has(fs, "fever_present", ["yes", "haan", "bukhar"]) or
                _has(fs, "associated_fever", ["yes", "haan"])
            )
        ),
    },
]


def check_safety(filled_state: dict) -> list[RedFlagEntry]:
    """
    Run ALL deterministic safety rules against the filled-state object.
    Returns triggered red-flag entries. Called after EVERY state update.
    """
    flags = []
    for rule in SAFETY_RULES:
        try:
            if rule["check"](filled_state):
                flags.append(RedFlagEntry(
                    rule_id=rule["id"],
                    description=rule["description"],
                    slot_values={k: v for k, v in filled_state.items() if isinstance(v, dict) and v.get("value")},
                ))
        except Exception:
            pass  # Safety rules must never crash the system
    return flags


def merge_safety_floor(generated_schema: dict, category: str) -> dict:
    """
    Post-generation validation: ensure all must-ask red-flag fields
    from the reference library are present in the generated schema.
    Force-insert any missing ones.
    """
    floor_fields = get_safety_floor(category)
    existing_ids = {f["id"] for f in generated_schema.get("fields", [])}

    for floor_field in floor_fields:
        if floor_field["id"] not in existing_ids:
            generated_schema.setdefault("fields", []).append(floor_field)

    return generated_schema
