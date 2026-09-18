"""
SwasthyaSync — Meso-Layer Template Registry (Architecture v2, §3)

Maps chief-complaint categories to ordered slot templates.
Also provides section-specific templates for PMH, PSH, Drug/Allergy,
Family Hx, Social Hx, and ROS — each using the same slot-filling
mechanism from §4.

Each template entry defines:
  - slots: ordered list of {id, prompt, options, required, red_flag_relevant}
  - The ordering is by clinical priority (red-flag-relevant first).
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class SlotSpec:
    """Specification for a single data slot in a template."""
    id: str
    prompt: str  # Default English prompt (LLM will rephrase + translate)
    options: list[str] = field(default_factory=list)
    required: bool = True
    red_flag_relevant: bool = False


@dataclass
class MesoTemplate:
    """A meso-layer template: an ordered list of slots."""
    name: str
    slots: list[SlotSpec] = field(default_factory=list)

    def required_slot_ids(self) -> list[str]:
        return [s.id for s in self.slots if s.required]

    def get_slot_spec(self, slot_id: str) -> SlotSpec | None:
        return next((s for s in self.slots if s.id == slot_id), None)

    def ordered_unfilled(self, filled_ids: set[str]) -> list[SlotSpec]:
        """Return unfilled slots, red-flag-relevant first, then by original order."""
        unfilled = [s for s in self.slots if s.id not in filled_ids]
        # Sort: red_flag_relevant first, then preserve original order
        return sorted(unfilled, key=lambda s: (not s.red_flag_relevant,))


# ──────────────────────────────────────────────────────────────────────
# HPI TEMPLATES — complaint-driven (§3 table)
# ──────────────────────────────────────────────────────────────────────

SOCRATES = MesoTemplate(
    name="SOCRATES",
    slots=[
        SlotSpec("location", "Where exactly is the pain?",
                 ["Head", "Chest", "Abdomen", "Back", "Limbs", "Other"], red_flag_relevant=True),
        SlotSpec("onset", "When did the pain start?",
                 ["Today", "Yesterday", "Few days ago", "Weeks ago", "Months ago"]),
        SlotSpec("character", "What does the pain feel like?",
                 ["Sharp", "Dull", "Burning", "Cramping", "Pressure", "Stabbing"]),
        SlotSpec("radiation", "Does the pain spread anywhere else?",
                 ["No spread", "Left arm", "Jaw", "Back", "Shoulder", "Other"], red_flag_relevant=True),
        SlotSpec("associated_symptoms", "Do you have any other symptoms with the pain?",
                 ["Nausea", "Sweating", "Breathlessness", "Dizziness", "None"], red_flag_relevant=True),
        SlotSpec("timing", "Is the pain constant or does it come and go?",
                 ["Constant", "Comes and goes", "Worse at night", "Worse with activity"]),
        SlotSpec("aggravating_factors", "What makes the pain worse or better?",
                 ["Movement", "Eating", "Breathing", "Rest helps", "Nothing helps"], required=False),
        SlotSpec("severity", "On a scale of 1-10, how severe is the pain?",
                 ["1-3 Mild", "4-6 Moderate", "7-8 Severe", "9-10 Unbearable"], red_flag_relevant=True),
    ]
)

FEVER_TEMPLATE = MesoTemplate(
    name="FEVER",
    slots=[
        SlotSpec("duration", "How long have you had the fever?",
                 ["Today", "1-2 days", "3-5 days", "More than a week"]),
        SlotSpec("pattern", "Is the fever continuous or does it come and go?",
                 ["Continuous", "Intermittent", "Night only", "Evening rise"]),
        SlotSpec("peak_temp", "What is the highest temperature you've measured?",
                 ["Don't know", "99-100°F", "100-102°F", "Above 102°F"], red_flag_relevant=True),
        SlotSpec("chills_rigors", "Do you have chills or rigors (shaking)?",
                 ["No", "Mild chills", "Severe shaking/rigors"], red_flag_relevant=True),
        SlotSpec("associated_symptoms", "Any other symptoms with the fever?",
                 ["Headache", "Body ache", "Cough", "Rash", "Vomiting", "None"]),
        SlotSpec("travel_exposure", "Any recent travel or exposure to sick contacts?",
                 ["No", "Travel within India", "International travel", "Sick contact"], required=False),
    ]
)

RESPIRATORY_TEMPLATE = MesoTemplate(
    name="RESPIRATORY",
    slots=[
        SlotSpec("duration", "How long have you had this breathing issue / cough?",
                 ["Today", "Few days", "1-2 weeks", "More than 2 weeks"]),
        SlotSpec("sputum", "Are you coughing up anything?",
                 ["Dry cough", "White/clear sputum", "Yellow/green sputum", "Blood-tinged"], red_flag_relevant=True),
        SlotSpec("hemoptysis", "Have you coughed up any blood?",
                 ["No", "Yes, streaks", "Yes, significant amount"], red_flag_relevant=True),
        SlotSpec("breathlessness", "How is your breathing difficulty?",
                 ["Only with heavy exertion", "Walking on flat ground", "At rest", "Cannot lie flat"], red_flag_relevant=True),
        SlotSpec("wheeze", "Do you hear any whistling sound while breathing?",
                 ["No", "Sometimes", "Often", "Constantly"]),
        SlotSpec("chest_pain", "Any chest pain with the breathing problem?",
                 ["No", "Yes, with coughing", "Yes, constant"], red_flag_relevant=True),
    ]
)

GI_TEMPLATE = MesoTemplate(
    name="GI",
    slots=[
        SlotSpec("location", "Where is the stomach/abdominal pain?",
                 ["Upper abdomen", "Lower abdomen", "Around navel", "Right side", "Left side", "All over"]),
        SlotSpec("onset", "When did it start?",
                 ["Today", "Yesterday", "Few days ago", "Weeks ago"]),
        SlotSpec("character", "What does it feel like?",
                 ["Cramping", "Burning", "Sharp", "Dull ache", "Pressure"]),
        SlotSpec("bowel_habit", "Have your bowel habits changed?",
                 ["Normal", "Diarrhea", "Constipation", "Alternating"], red_flag_relevant=True),
        SlotSpec("blood_stool_vomit", "Any blood in stool or vomit?",
                 ["No", "Blood in stool", "Blood in vomit", "Both"], red_flag_relevant=True),
        SlotSpec("appetite", "How is your appetite?",
                 ["Normal", "Decreased", "No appetite", "Increased"]),
        SlotSpec("weight_change", "Any recent weight change?",
                 ["No", "Lost weight", "Gained weight"], red_flag_relevant=True),
    ]
)

GENERAL_DOPS = MesoTemplate(
    name="DOPS",
    slots=[
        SlotSpec("duration", "How long have you been feeling this way?",
                 ["Days", "Weeks", "Months", "More than 6 months"]),
        SlotSpec("onset", "Did it start suddenly or gradually?",
                 ["Suddenly", "Gradually"]),
        SlotSpec("progression", "Is it getting worse, better, or staying the same?",
                 ["Getting worse", "Staying the same", "Getting better"]),
        SlotSpec("severity", "How much does it affect your daily activities?",
                 ["Not much", "Some difficulty", "Significant difficulty", "Cannot do daily activities"], red_flag_relevant=True),
        SlotSpec("associated_symptoms", "Any other symptoms?",
                 ["Fever", "Weight loss", "Night sweats", "Fatigue", "None"], red_flag_relevant=True),
    ]
)

# Map complaint categories to HPI templates
HPI_TEMPLATE_REGISTRY: dict[str, MesoTemplate] = {
    "pain": SOCRATES,
    "fever": FEVER_TEMPLATE,
    "respiratory": RESPIRATORY_TEMPLATE,
    "gi": GI_TEMPLATE,
    "general": GENERAL_DOPS,
}


# ──────────────────────────────────────────────────────────────────────
# SECTION TEMPLATES — for PMH, PSH, Drug/Allergy, Family Hx, etc.
# ──────────────────────────────────────────────────────────────────────

PMH_TEMPLATE = MesoTemplate(
    name="PMH",
    slots=[
        SlotSpec("diabetes", "Do you have diabetes?", ["No", "Type 1", "Type 2", "Don't know"]),
        SlotSpec("hypertension", "Do you have high blood pressure?", ["No", "Yes", "Don't know"]),
        SlotSpec("heart_disease", "Any heart disease?", ["No", "Yes", "Don't know"]),
        SlotSpec("asthma_copd", "Do you have asthma or any lung disease?", ["No", "Asthma", "COPD", "Other"]),
        SlotSpec("thyroid", "Any thyroid problems?", ["No", "Hypothyroid", "Hyperthyroid", "Don't know"]),
        SlotSpec("other_conditions", "Any other medical conditions?",
                 ["None", "Kidney disease", "Liver disease", "Cancer", "Epilepsy", "Other"], required=False),
    ]
)

PSH_TEMPLATE = MesoTemplate(
    name="PSH",
    slots=[
        SlotSpec("any_surgery", "Have you had any surgeries in the past?", ["No", "Yes"]),
        SlotSpec("surgery_details", "What surgery was it?",
                 ["Appendix", "Hernia", "Caesarean", "Fracture repair", "Heart surgery", "Other"], required=False),
        SlotSpec("surgery_when", "When was the surgery?",
                 ["Within last year", "1-5 years ago", "More than 5 years ago"], required=False),
        SlotSpec("any_complications", "Were there any complications?", ["No", "Yes"], required=False),
    ]
)

DRUG_ALLERGY_TEMPLATE = MesoTemplate(
    name="DRUG_ALLERGY",
    slots=[
        SlotSpec("current_medications", "Are you currently taking any medicines?",
                 ["No", "Yes"]),
        SlotSpec("medication_names", "Which medicines are you taking?",
                 ["Blood pressure medicine", "Diabetes medicine", "Pain killers", "Inhalers", "Other"], required=False),
        SlotSpec("any_allergies", "Are you allergic to any medicines?",
                 ["No", "Yes", "Don't know"], red_flag_relevant=True),
        SlotSpec("allergy_details", "Which medicines are you allergic to?",
                 ["Penicillin", "Sulfa drugs", "Aspirin", "Other"], required=False),
    ]
)

FAMILY_HX_TEMPLATE = MesoTemplate(
    name="FAMILY_HX",
    slots=[
        SlotSpec("family_diabetes", "Does anyone in your family have diabetes?",
                 ["No", "Parent", "Sibling", "Don't know"]),
        SlotSpec("family_heart", "Any heart disease in the family?",
                 ["No", "Parent", "Sibling", "Don't know"]),
        SlotSpec("family_cancer", "Any cancer in the family?",
                 ["No", "Yes", "Don't know"]),
        SlotSpec("family_other", "Any other significant family health conditions?",
                 ["None", "Hypertension", "Stroke", "Kidney disease", "Mental health", "Other"], required=False),
    ]
)

SOCIAL_HX_TEMPLATE = MesoTemplate(
    name="SOCIAL_HX",
    slots=[
        SlotSpec("smoking", "Do you smoke?", ["Never", "Currently", "Quit"]),
        SlotSpec("alcohol", "Do you consume alcohol?", ["Never", "Occasionally", "Regularly", "Quit"]),
        SlotSpec("tobacco_chewing", "Do you chew tobacco or gutka?", ["No", "Yes"]),
        SlotSpec("occupation", "What is your occupation?",
                 ["Office work", "Manual labor", "Farming", "Student", "Homemaker", "Retired", "Other"], required=False),
        SlotSpec("diet", "What type of diet do you follow?",
                 ["Vegetarian", "Non-vegetarian", "Vegan", "Mixed"], required=False),
    ]
)

ROS_TEMPLATE = MesoTemplate(
    name="ROS",
    slots=[
        SlotSpec("weight_change", "Any unintentional weight loss or gain?",
                 ["No", "Weight loss", "Weight gain"], red_flag_relevant=True),
        SlotSpec("night_sweats", "Do you experience night sweats?", ["No", "Yes"], red_flag_relevant=True),
        SlotSpec("appetite_change", "Any change in appetite?", ["No", "Decreased", "Increased"]),
        SlotSpec("sleep_quality", "How is your sleep?",
                 ["Good", "Difficulty falling asleep", "Waking up at night", "Poor"]),
        SlotSpec("urinary", "Any urinary problems?",
                 ["No", "Burning", "Frequency", "Blood in urine"], red_flag_relevant=True),
        SlotSpec("vision_hearing", "Any change in vision or hearing?", ["No", "Vision change", "Hearing change"],
                 required=False),
    ]
)

# Map macro-FSM section names to their templates
SECTION_TEMPLATE_REGISTRY: dict[str, MesoTemplate] = {
    "PMH": PMH_TEMPLATE,
    "PSH": PSH_TEMPLATE,
    "DRUG_ALLERGY": DRUG_ALLERGY_TEMPLATE,
    "FAMILY_HX": FAMILY_HX_TEMPLATE,
    "SOCIAL_HX": SOCIAL_HX_TEMPLATE,
    "ROS": ROS_TEMPLATE,
}


# ──────────────────────────────────────────────────────────────────────
# AYUSH TEMPLATES — Dashavidha Pariksha (§6)
# Patient-reportable sub-templates only; Ashtavidha Pariksha is
# physician-side and NOT included here (§6 correction).
# ──────────────────────────────────────────────────────────────────────

AYUSH_TEMPLATE = MesoTemplate(
    name="AYUSH_DASHAVIDHA",
    slots=[
        SlotSpec("prakriti_body", "How would you describe your body type?",
                 ["Thin/light frame", "Medium/muscular", "Heavy/stocky"]),
        SlotSpec("prakriti_skin", "How is your skin generally?",
                 ["Dry/rough", "Warm/oily", "Smooth/cool"]),
        SlotSpec("prakriti_temperament", "How would you describe your temperament?",
                 ["Anxious/creative", "Focused/intense", "Calm/steady"]),
        SlotSpec("vikriti", "What imbalance are you currently feeling?",
                 ["Dryness/gas/anxiety", "Heat/acidity/irritation", "Heaviness/congestion/lethargy", "Mixed"]),
        SlotSpec("agni", "How is your digestive capacity?",
                 ["Very Weak", "Weak", "Moderate", "Strong", "Very Strong/Irregular"]),
        SlotSpec("koshtha", "What is your bowel nature?",
                 ["Madhyama (regular)", "Mridu (loose tendency)", "Krura (constipation tendency)"]),
        SlotSpec("satmya", "How well do you adapt to changes in weather/food?",
                 ["Poorly", "Moderately", "Well"]),
        SlotSpec("sattva", "How would you rate your mental resilience?",
                 ["Low (easily stressed)", "Moderate", "High (resilient)"]),
        SlotSpec("ahara_shakti", "How is your appetite and digestion?",
                 ["Poor appetite, slow digestion", "Good appetite, fast digestion", "Variable"]),
        SlotSpec("vyayama_shakti", "How is your exercise tolerance?",
                 ["Low endurance", "Moderate", "High endurance"]),
        SlotSpec("vaya", "How would you describe your biological age vs actual age?",
                 ["Feel younger", "Feel my age", "Feel older"]),
        SlotSpec("diet_type", "What type of diet do you follow?",
                 ["Vata-pacifying", "Pitta-pacifying", "Kapha-pacifying", "Mixed/No specific"]),
        SlotSpec("sleep_pattern", "How would you describe your sleep?",
                 ["Sound & Refreshing", "Disturbed", "Light", "Insomnia", "Hypersomnia"]),
    ]
)
