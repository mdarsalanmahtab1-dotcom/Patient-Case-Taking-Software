"""
SwasthyaSync — AYUSH / Ayurveda Fixed Template Registry & Prakriti Engine

Grounded in the official CCRAS Manual of Standard Operative Procedures
for Prakriti Assessment (Ministry of AYUSH, Govt. of India, ISBN: 978-93-83864-21-8).

NON-NEGOTIABLE ARCHITECTURAL PRINCIPLE:
Unlike allopathic intake (which dynamically generates fields per complaint via LLM),
AYUSH intake questions are derived from a FIXED, non-LLM template to eliminate
hallucination risk in Ayurvedic diagnostic categories.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# 1. CCRAS 14-Item Predictor Slot Specifications
# ──────────────────────────────────────────────────────────────────────

@dataclass
class AyushPredictor:
    id: str
    question_intent: str
    domain: str  # physical | physiological | psychological | behavioral
    ccras_sop_ref: str
    options: List[Dict[str, str]]  # list of {"label": ..., "dosha": "vata"|"pitta"|"kapha"}
    priority: str = "high"


CCRAS_PREDICTORS: List[AyushPredictor] = [
    # ── Trait 1: Physical (Sharirika) ──
    AyushPredictor(
        id="prakriti_built",
        question_intent="General adult body frame and build habitus",
        domain="physical",
        ccras_sop_ref="SOP 1.1 (Built)",
        options=[
            {"label": "Thin / Slender frame, difficulty gaining weight", "dosha": "vata"},
            {"label": "Medium / Proportionate build, moderate weight", "dosha": "pitta"},
            {"label": "Broad / Heavy / Well-built frame, gains weight easily", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_skin",
        question_intent="Natural skin texture without moisturiser",
        domain="physical",
        ccras_sop_ref="SOP 1.4 (Skin Texture)",
        options=[
            {"label": "Dry, rough, or cracks easily in cool weather", "dosha": "vata"},
            {"label": "Warm, sensitive, prone to redness or flushing", "dosha": "pitta"},
            {"label": "Smooth, soft, cool, slightly oily, well-hydrated", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_hair",
        question_intent="Natural hair quality and texture",
        domain="physical",
        ccras_sop_ref="SOP 1.5 (Hair Character)",
        options=[
            {"label": "Dry, thin, coarse, frizzy, or prone to split ends", "dosha": "vata"},
            {"label": "Fine, soft, blonde/reddish tint, early greying or thinning", "dosha": "pitta"},
            {"label": "Thick, dark, lustrous, wavy, and strong roots", "dosha": "kapha"},
        ],
        priority="high",
    ),

    # ── Trait 2: Physiological (Sharirika Kriya) ──
    AyushPredictor(
        id="prakriti_appetite",
        question_intent="Hunger regularity and digestive rhythm (Agni)",
        domain="physiological",
        ccras_sop_ref="SOP 2.1 (Agni / Ahara)",
        options=[
            {"label": "Irregular and unpredictable — sometimes hungry, sometimes not", "dosha": "vata"},
            {"label": "Intense and sharp — get irritable or weak if meals are delayed", "dosha": "pitta"},
            {"label": "Steady and low — can easily skip meals without discomfort", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_thirst",
        question_intent="Daily thirst intensity and fluid requirement (Pipasa)",
        domain="physiological",
        ccras_sop_ref="SOP 2.4 (Thirst)",
        options=[
            {"label": "Low or variable thirst, often forget to drink water", "dosha": "vata"},
            {"label": "Frequent and intense thirst, need water immediately", "dosha": "pitta"},
            {"label": "Rarely thirsty, comfortable with minimal fluid intake", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_eating_speed",
        question_intent="Speed and pace of eating meals (Ahara Gati)",
        domain="physiological",
        ccras_sop_ref="SOP 2.3 (Ahara Gati)",
        options=[
            {"label": "Fast and quick eater", "dosha": "vata"},
            {"label": "Moderate, regular eating pace", "dosha": "pitta"},
            {"label": "Slow, deliberate, and relaxed eater", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_bowel",
        question_intent="Bowel evacuation consistency and frequency (Koshtha)",
        domain="physiological",
        ccras_sop_ref="SOP 2.2 (Koshtha / Mala)",
        options=[
            {"label": "Dry, hard stool, tendency toward constipation or irregular timing", "dosha": "vata"},
            {"label": "Soft or loose stool, frequent or urgent movements", "dosha": "pitta"},
            {"label": "Regular, formed, heavy stool, once daily with slow evacuation", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_sleep",
        question_intent="Depth, duration, and soundness of sleep (Nidra)",
        domain="physiological",
        ccras_sop_ref="SOP 2.5 (Nidra)",
        options=[
            {"label": "Light, easily awakened by small noises, restless sleep", "dosha": "vata"},
            {"label": "Moderate sound sleep (6-7 hours), awaken if hot or stressed", "dosha": "pitta"},
            {"label": "Deep, heavy, uninterrupted sleep (8+ hours), hard to wake up", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_weather",
        question_intent="Climate and temperature sensitivity (Sheeta/Ushna Sahishnuta)",
        domain="physiological",
        ccras_sop_ref="SOP 2.6 (Thermal Tolerance)",
        options=[
            {"label": "Cannot tolerate cold wind or chilly weather; loves warmth", "dosha": "vata"},
            {"label": "Cannot tolerate hot sun or summer heat; always seeks coolness", "dosha": "pitta"},
            {"label": "Dislikes cold damp weather, but comfortable in warm dry air", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_perspiration",
        question_intent="Tendency and volume of sweating (Sweda)",
        domain="physiological",
        ccras_sop_ref="SOP 2.7 (Sweda)",
        options=[
            {"label": "Minimal or scant perspiration even when warm, odorless", "dosha": "vata"},
            {"label": "Profuse and rapid sweating, hot body feel, noticeable strong odor", "dosha": "pitta"},
            {"label": "Moderate sweating only after heavy physical exertion", "dosha": "kapha"},
        ],
        priority="high",
    ),

    # ── Trait 3: Psychological (Manasika) ──
    AyushPredictor(
        id="prakriti_decisiveness",
        question_intent="Decision consistency and confidence (Anavasthita Atma)",
        domain="psychological",
        ccras_sop_ref="SOP 3.1 (Indecisiveness)",
        options=[
            {"label": "Frequently second-guess, hesitate, or change my mind", "dosha": "vata"},
            {"label": "Decide quickly, confident, stick firmly to decisions", "dosha": "pitta"},
            {"label": "Take time to decide, but once decided, rarely or never change", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_memory",
        question_intent="Grasping speed vs long-term retention (Grahya & Smriti Shakti)",
        domain="psychological",
        ccras_sop_ref="SOP 3.2 (Comprehension & Memory)",
        options=[
            {"label": "Grasp new ideas very quickly, but tend to forget details quickly", "dosha": "vata"},
            {"label": "Grasp quickly, analyze sharply, and remember accurately", "dosha": "pitta"},
            {"label": "Take longer to learn or grasp, but remember permanently for years", "dosha": "kapha"},
        ],
        priority="high",
    ),
    AyushPredictor(
        id="prakriti_temperament",
        question_intent="Emotional response to irritation or provocation (Krodha)",
        domain="psychological",
        ccras_sop_ref="SOP 3.3 & 4.6 (Krodha / Vineeta)",
        options=[
            {"label": "Get worried or irritated quickly, but calm down very fast", "dosha": "vata"},
            {"label": "Flash with intense anger or impatience quickly, hold tension", "dosha": "pitta"},
            {"label": "Rarely get angry, highly patient, calm, and forgiving", "dosha": "kapha"},
        ],
        priority="high",
    ),

    # ── Trait 4: Behavioral (Vyavaharika) ──
    AyushPredictor(
        id="prakriti_speech_pace",
        question_intent="Speaking style and daily movement pace (Vak & Pravritti)",
        domain="behavioral",
        ccras_sop_ref="SOP 4.1 (Vak)",
        options=[
            {"label": "Fast-talking, expressive, energetic, always on the move", "dosha": "vata"},
            {"label": "Articulate, clear, purposeful, direct and sharp speech", "dosha": "pitta"},
            {"label": "Slow, gentle, measured tone, calm and unhurried pace", "dosha": "kapha"},
        ],
        priority="high",
    ),
]


# ──────────────────────────────────────────────────────────────────────
# 2. Fixed Schema Builder (Non-LLM)
# ──────────────────────────────────────────────────────────────────────

def get_ayush_schema(chief_complaint: str, category: str) -> dict:
    """
    Build a deterministic, fixed AYUSH intake schema.
    Contains universal baseline HPI questions + 14 CCRAS Prakriti questions.
    ZERO LLM calls involved in schema generation.
    """
    # Universal baseline complaint questions (Pillar 1)
    baseline_fields = [
        {
            "id": "symptom_onset",
            "question_intent": "When did your main symptom or discomfort start?",
            "type": "string",
            "priority": "critical",
            "red_flag": False,
            "fork_eligible": False,
            "category": "HPI",
            "conditional_on": None,
        },
        {
            "id": "symptom_duration",
            "question_intent": "How long has this complaint been going on?",
            "type": "string",
            "priority": "critical",
            "red_flag": False,
            "fork_eligible": False,
            "category": "HPI",
            "conditional_on": None,
        },
        {
            "id": "symptom_severity",
            "question_intent": "How much does this discomfort affect your daily routine?",
            "type": "string",
            "priority": "high",
            "red_flag": False,
            "fork_eligible": False,
            "category": "HPI",
            "conditional_on": None,
        },
        {
            "id": "current_medications",
            "question_intent": "Are you taking any current allopathic or Ayurvedic medicines?",
            "type": "string",
            "priority": "high",
            "red_flag": False,
            "fork_eligible": False,
            "category": "DH",
            "conditional_on": None,
        },
    ]

    # Convert CCRAS predictors to schema fields
    prakriti_fields = []
    for pred in CCRAS_PREDICTORS:
        suggested_opts = [{"label": opt["label"], "value": opt["label"]} for opt in pred.options]
        prakriti_fields.append({
            "id": pred.id,
            "question_intent": pred.question_intent,
            "type": "string",
            "priority": pred.priority,
            "red_flag": False,
            "fork_eligible": False,
            "category": "PRAKRITI",
            "conditional_on": None,
            "options": suggested_opts,
        })

    all_fields = baseline_fields + prakriti_fields

    return {
        "chief_complaint": chief_complaint,
        "fields": all_fields,
    }


# ──────────────────────────────────────────────────────────────────────
# 3. NAMASTE & NAMC Standardized Terminology Tables
# ──────────────────────────────────────────────────────────────────────

NAMASTE_PRAKRITI_CODES = {
    "Vataja": {"code": "AYU-PRA-01", "name_en": "Vataja Prakriti (Predominantly Vata)"},
    "Pittaja": {"code": "AYU-PRA-02", "name_en": "Pittaja Prakriti (Predominantly Pitta)"},
    "Kaphaja": {"code": "AYU-PRA-03", "name_en": "Kaphaja Prakriti (Predominantly Kapha)"},
    "Vata-Pittaja": {"code": "AYU-PRA-04", "name_en": "Vata-Pittaja Prakriti (Vata & Pitta Dual)"},
    "Pitta-Vataja": {"code": "AYU-PRA-04", "name_en": "Pitta-Vataja Prakriti (Pitta & Vata Dual)"},
    "Pitta-Kaphaja": {"code": "AYU-PRA-05", "name_en": "Pitta-Kaphaja Prakriti (Pitta & Kapha Dual)"},
    "Kapha-Pittaja": {"code": "AYU-PRA-05", "name_en": "Kapha-Pittaja Prakriti (Kapha & Pitta Dual)"},
    "Vata-Kaphaja": {"code": "AYU-PRA-06", "name_en": "Vata-Kaphaja Prakriti (Vata & Kapha Dual)"},
    "Kapha-Vataja": {"code": "AYU-PRA-06", "name_en": "Kapha-Vataja Prakriti (Kapha & Vata Dual)"},
    "Samadoshaja": {"code": "AYU-PRA-07", "name_en": "Samadoshaja Prakriti (Balanced Tridosha)"},
}

NAMC_CHIEF_COMPLAINT_MAPPING = {
    "pain": {"namc": "MG-1", "ayur_name": "Sandhigata Vata / Shoola", "vikriti": "Vata Dushti"},
    "joint": {"namc": "MG-1", "ayur_name": "Sandhigata Vata (Osteoarthritis)", "vikriti": "Vata Dushti"},
    "arthritis": {"namc": "MG-2", "ayur_name": "Amavata (Rheumatoid / Inflammatory)", "vikriti": "Ama + Vata"},
    "acid": {"namc": "EB-4", "ayur_name": "Amlapitta (Hyperacidity / GERD)", "vikriti": "Pitta Dushti"},
    "acidity": {"namc": "EB-4", "ayur_name": "Amlapitta (Hyperacidity / GERD)", "vikriti": "Pitta Dushti"},
    "gas": {"namc": "EB-5", "ayur_name": "Anaha / Adhmana (Abdominal Distension)", "vikriti": "Vata Dushti (Apana)"},
    "cough": {"namc": "EA-3", "ayur_name": "Kasa (Cough)", "vikriti": "Vata-Kapha Pranavaha"},
    "breath": {"namc": "EA-4", "ayur_name": "Shwasa (Dyspnea / Asthma)", "vikriti": "Vata-Kapha"},
    "fever": {"namc": "AA-1", "ayur_name": "Jwara (Pyrexia)", "vikriti": "Pitta-Ama"},
    "back": {"namc": "MG-4", "ayur_name": "Katishoola / Gridhrasi (Back Pain)", "vikriti": "Vata Dushti"},
    "skin": {"namc": "DE-1", "ayur_name": "Kushtha / Tvak Vikara (Dermatosis)", "vikriti": "Pitta-Rakta"},
    "headache": {"namc": "NE-2", "ayur_name": "Shirashoola (Cephalea)", "vikriti": "Vata-Pitta"},
}


# ──────────────────────────────────────────────────────────────────────
# 4. Pathya & Apathya (Diet & Lifestyle Advisory) Knowledge Base
# ──────────────────────────────────────────────────────────────────────

PATHYA_APATHYA_DATABASE = {
    "vata": {
        "title": "Vata Pacifying Regimen (Vata Shamana)",
        "pathya_diet": "Warm, freshly cooked, nourishing meals with adequate cow's ghee and sesame oil. Favor sweet, sour, and salty tastes. Warm milk with a pinch of nutmeg or ginger, hearty vegetable stews, cooked whole grains (rice, wheat).",
        "pathya_lifestyle": "Maintain a regular daily routine (Dinacharya) with consistent sleep times. Practice daily gentle warm oil massage (Abhyanga). Stay warm and avoid drafty, cold air.",
        "apathya_avoid": "Avoid dry crackers, raw cold salads, iced beverages, irregular meal timings, fasting, staying awake late at night (Ratri Jagarana), and excessive multi-tasking.",
    },
    "pitta": {
        "title": "Pitta Pacifying Regimen (Pitta Shamana)",
        "pathya_diet": "Cooling, soothing, mildly spiced meals. Favor sweet, bitter, and astringent tastes. Pure cow's ghee, coconut water, fennel/coriander infused water, sweet juicy fruits (grapes, melons), green leafy vegetables, basmati rice.",
        "pathya_lifestyle": "Keep living spaces cool and well-ventilated. Enjoy pleasant, calming evening walks in moonlight (Sheetala Vihara). Practice patience, moderation, and cooling breathing exercises (Sheetali).",
        "apathya_avoid": "Avoid excessively spicy/pungent chilies, deep-fried snacks, vinegar, sour pickles, fermented foods, excessive direct sun exposure, and skipping meals when hungry.",
    },
    "kapha": {
        "title": "Kapha Pacifying Regimen (Kapha Shamana)",
        "pathya_diet": "Light, warm, dry, easily digestible meals. Favor pungent, bitter, and astringent tastes. Barley (Yava), millets, warm water with honey (Madhu), warming spices (ginger, black pepper, turmeric), steamed seasonal vegetables.",
        "pathya_lifestyle": "Engage in active physical exercise (Vyayama) such as brisk walking or Surya Namaskara. Wake up early before sunrise (around 5:30-6:00 AM). Practice dry herbal powder massage (Udvartana).",
        "apathya_avoid": "Avoid heavy sweets, excessive dairy products (ice cream, cheese, cold curd at night), deep-fried oily items, daytime sleep (Diva Swapna), and prolonged sedentary habits.",
    },
}


# ──────────────────────────────────────────────────────────────────────
# 5. Deterministic Dosha Scoring & Prakriti Determination
# ──────────────────────────────────────────────────────────────────────

def calculate_prakriti(filled_state: dict, chief_complaint: str = "") -> dict:
    """
    Deterministically calculate Prakriti from filled questionnaire answers.
    Evaluates Vata, Pitta, Kapha scores from the 14 CCRAS items.
    
    Returns a comprehensive result dictionary with:
      - dominant_dosha: e.g. "Pitta-Vataja"
      - namaste_code: e.g. "AYU-PRA-04"
      - dosha_scores: {"vata": 6, "pitta": 5, "kapha": 3}
      - dosha_percentages: {"vata": 43, "pitta": 36, "kapha": 21}
      - vikriti: inferred doshic imbalance from chief complaint
      - pathya_apathya: tailored lifestyle and dietary advisory
      - clinical_summary: 2-3 line synthesis for doctor and dashboard
    """
    if isinstance(filled_state, dict) and "filled_state" in filled_state and isinstance(filled_state["filled_state"], dict):
        filled_state = filled_state["filled_state"]

    scores = {"vata": 0, "pitta": 0, "kapha": 0}
    answered_count = 0

    predictor_map = {pred.id: pred for pred in CCRAS_PREDICTORS}

    for field_id, pred in predictor_map.items():
        entry = filled_state.get(field_id)
        if not entry:
            continue
        val = entry.get("value", "") if isinstance(entry, dict) else str(entry)
        val_lower = str(val).lower().strip()
        if not val_lower or val_lower in ("none", "null", ""):
            continue

        answered_count += 1
        matched = False
        for opt in pred.options:
            label_lower = opt["label"].lower()
            first_keyword = label_lower.split(",")[0].split("/")[0].strip()
            if label_lower in val_lower or val_lower in label_lower or first_keyword in val_lower:
                scores[opt["dosha"]] += 1
                matched = True
                break
        
        if not matched:
            if any(w in val_lower for w in ["thin", "slender", "dry", "rough", "irregular", "low thirst", "fast", "constipat", "light sleep", "cold", "change mind", "forget", "worry"]):
                scores["vata"] += 1
            elif any(w in val_lower for w in ["medium", "proportion", "warm", "sensitive", "fine", "sharp", "intense", "frequent", "loose", "moderate sleep", "heat", "sweat", "decisive", "anger", "articulate"]):
                scores["pitta"] += 1
            elif any(w in val_lower for w in ["heavy", "broad", "smooth", "soft", "thick", "lustrous", "steady", "slow", "rare", "formed", "deep sleep", "hard to wake", "damp", "deliberate", "remember", "patient", "forgiv"]):
                scores["kapha"] += 1

    total_marks = sum(scores.values()) or 1
    pct_vata = round((scores["vata"] / total_marks) * 100)
    pct_pitta = round((scores["pitta"] / total_marks) * 100)
    pct_kapha = max(0, 100 - (pct_vata + pct_pitta))

    sorted_doshas = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    d1_name, d1_val = sorted_doshas[0]
    d2_name, d2_val = sorted_doshas[1]
    d3_name, d3_val = sorted_doshas[2]

    if (d1_val - d3_val) <= 1 and answered_count >= 6:
        dominant_key = "Samadoshaja"
        display_name = "Samadoshaja Prakriti (Equilibrium)"
        primary_dosha_key = "vata"
    elif (d1_val - d2_val) >= 3:
        p_name = d1_name.capitalize() + "ja"
        dominant_key = p_name
        display_name = f"{d1_name.capitalize()}ja Prakriti ({d1_name.capitalize()} Dominant)"
        primary_dosha_key = d1_name
    else:
        p_name = f"{d1_name.capitalize()}-{d2_name.capitalize()}ja"
        dominant_key = p_name
        display_name = f"{p_name} Prakriti ({d1_name.capitalize()}-{d2_name.capitalize()} Dual)"
        primary_dosha_key = d1_name

    namaste_meta = NAMASTE_PRAKRITI_CODES.get(dominant_key, {
        "code": "AYU-PRA-04",
        "name_en": display_name
    })

    vikriti_info = {"namc": "GEN-01", "ayur_name": "Samanya Roga", "vikriti": f"{primary_dosha_key.capitalize()} Pravritti"}
    cc_lower = chief_complaint.lower()
    for kw, mapping in NAMC_CHIEF_COMPLAINT_MAPPING.items():
        if kw in cc_lower:
            vikriti_info = mapping
            break

    regimen = PATHYA_APATHYA_DATABASE.get(primary_dosha_key, PATHYA_APATHYA_DATABASE["vata"])

    clinical_summary = (
        f"Ayurvedic Constitutional Assessment (CCRAS): {display_name} [NAMASTE: {namaste_meta['code']}]. "
        f"Doshic Distribution: Vata {pct_vata}%, Pitta {pct_pitta}%, Kapha {pct_kapha}%. "
        f"Chief Complaint Presentation: {vikriti_info['ayur_name']} (NAMC: {vikriti_info['namc']}) reflecting {vikriti_info['vikriti']}. "
        f"Recommended Lifestyle: {regimen['title']}."
    )

    return {
        "dominant_dosha": display_name,
        "dominant_dosha_key": primary_dosha_key,
        "namaste_code": namaste_meta["code"],
        "namaste_title": namaste_meta["name_en"],
        "dosha_scores": scores,
        "dosha_percentages": {
            "vata": pct_vata,
            "pitta": pct_pitta,
            "kapha": pct_kapha,
        },
        "vikriti": {
            "chief_complaint": chief_complaint,
            "ayurvedic_name": vikriti_info["ayur_name"],
            "namc_code": vikriti_info["namc"],
            "doshic_imbalance": vikriti_info["vikriti"],
        },
        "pathya_apathya": {
            "title": regimen["title"],
            "pathya_diet": regimen["pathya_diet"],
            "pathya_lifestyle": regimen["pathya_lifestyle"],
            "apathya_avoid": regimen["apathya_avoid"],
        },
        "clinical_summary": clinical_summary,
        "answered_predictors": answered_count,
    }
