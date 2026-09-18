"""
SwasthyaSync — Fast-Path Triage Caching Layer

Provides zero-latency (< 5ms) cached questions and options for standard clinical fields
across supported Indian languages (Hindi, Tamil, Telugu, English, etc.), bypassing LLM overhead.
"""

from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

# Pre-formatted local fast-path dictionary indexed by (field_id, language)
FAST_PATH_CACHE: dict[tuple[str, str], dict] = {
    # ── ONSET ──
    ("symptom_onset", "en-IN"): {
        "spoken_text": "When did your symptoms first start?",
        "suggested_options": [
            {"label": "Today / Just started", "label_translated": "Today / Just started"},
            {"label": "Yesterday", "label_translated": "Yesterday"},
            {"label": "2-3 days ago", "label_translated": "2-3 days ago"},
            {"label": "1 week ago or more", "label_translated": "1 week ago or more"},
            {"label": "Over a month ago", "label_translated": "Over a month ago"},
        ]
    },
    ("symptom_onset", "hi-IN"): {
        "spoken_text": "आपकी समस्या या लक्षण सबसे पहले कब शुरू हुए थे?",
        "suggested_options": [
            {"label": "Today / Just started", "label_translated": "आज ही / अभी शुरू हुआ"},
            {"label": "Yesterday", "label_translated": "कल से"},
            {"label": "2-3 days ago", "label_translated": "2-3 दिन पहले"},
            {"label": "1 week ago or more", "label_translated": "1 हफ्ते या उससे अधिक समय से"},
            {"label": "Over a month ago", "label_translated": "एक महीने से अधिक समय से"},
        ]
    },
    ("symptom_onset", "ta-IN"): {
        "spoken_text": "உங்கள் அறிகுறிகள் எப்போது தொடங்கின?",
        "suggested_options": [
            {"label": "Today / Just started", "label_translated": "இன்று / இப்போது தொடங்கியது"},
            {"label": "Yesterday", "label_translated": "நேற்று"},
            {"label": "2-3 days ago", "label_translated": "2-3 நாட்களுக்கு முன்பு"},
            {"label": "1 week ago or more", "label_translated": "1 வாரத்திற்கு முன்பு"},
        ]
    },
    ("symptom_onset", "te-IN"): {
        "spoken_text": "మీ లక్షణాలు ఎప్పుడు ప్రారంభమయ్యాయి?",
        "suggested_options": [
            {"label": "Today / Just started", "label_translated": "ఈరోజే / ఇప్పుడే ప్రారంభమైంది"},
            {"label": "Yesterday", "label_translated": "నిన్న"},
            {"label": "2-3 days ago", "label_translated": "2-3 రోజుల క్రితం"},
            {"label": "1 week ago or more", "label_translated": "1 వారం క్రితం"},
        ]
    },

    # ── SEVERITY & IMPACT ──
    ("symptom_severity_impact", "en-IN"): {
        "spoken_text": "How severe is your discomfort right now?",
        "suggested_options": [
            {"label": "Mild - noticeable but tolerable", "label_translated": "Mild - noticeable but tolerable"},
            {"label": "Moderate - affects daily activities", "label_translated": "Moderate - affects daily activities"},
            {"label": "Severe - unbearable / cannot work", "label_translated": "Severe - unbearable / cannot work"},
        ]
    },
    ("symptom_severity_impact", "hi-IN"): {
        "spoken_text": "आपको इस समय कितना दर्द या तकलीफ महसूस हो रही है?",
        "suggested_options": [
            {"label": "Mild - noticeable but tolerable", "label_translated": "हल्का - सहन योग्य है"},
            {"label": "Moderate - affects daily activities", "label_translated": "मध्यम - दैनिक कार्यों में परेशानी"},
            {"label": "Severe - unbearable / cannot work", "label_translated": "गंभीर - असहनीय दर्द"},
        ]
    },

    # ── PRIOR EPISODES ──
    ("prior_episodes", "en-IN"): {
        "spoken_text": "Have you ever experienced this same symptom or condition before?",
        "suggested_options": [
            {"label": "No, first time", "label_translated": "No, first time"},
            {"label": "Yes, a few times", "label_translated": "Yes, a few times"},
            {"label": "Yes, chronic issue", "label_translated": "Yes, chronic issue"},
        ]
    },
    ("prior_episodes", "hi-IN"): {
        "spoken_text": "क्या आपको पहले भी कभी ऐसी समस्या या लक्षण हुए हैं?",
        "suggested_options": [
            {"label": "No, first time", "label_translated": "नहीं, यह पहली बार है"},
            {"label": "Yes, a few times", "label_translated": "हाँ, पहले भी कुछ बार हुआ है"},
            {"label": "Yes, chronic issue", "label_translated": "हाँ, यह पुरानी समस्या है"},
        ]
    },

    # ── CURRENT MEDICATIONS ──
    ("current_medications", "en-IN"): {
        "spoken_text": "Are you currently taking any regular medications or supplements?",
        "suggested_options": [
            {"label": "None", "label_translated": "None"},
            {"label": "BP / Heart medicine", "label_translated": "BP / Heart medicine"},
            {"label": "Diabetes medicine", "label_translated": "Diabetes medicine"},
            {"label": "Painkillers / Antibiotics", "label_translated": "Painkillers / Antibiotics"},
            {"label": "Ayurvedic / Herbal remedies", "label_translated": "Ayurvedic / Herbal remedies"},
        ]
    },
    ("current_medications", "hi-IN"): {
        "spoken_text": "क्या आप वर्तमान में कोई नियमित दवाइयां या गोलियां ले रहे हैं?",
        "suggested_options": [
            {"label": "None", "label_translated": "कोई नहीं"},
            {"label": "BP / Heart medicine", "label_translated": "बीपी / दिल की दवा"},
            {"label": "Diabetes medicine", "label_translated": "शुगर / डायबिटीज की दवा"},
            {"label": "Painkillers / Antibiotics", "label_translated": "दर्द निवारक / एंटीबायोटिक"},
            {"label": "Ayurvedic / Herbal remedies", "label_translated": "आयुर्वेदिक / देसी दवाइयां"},
        ]
    },

    # ── KNOWN ALLERGIES ──
    ("known_allergies", "en-IN"): {
        "spoken_text": "Do you have any known allergies to medicines, foods, or substances?",
        "suggested_options": [
            {"label": "No known allergies", "label_translated": "No known allergies"},
            {"label": "Allergic to Penicillin / Antibiotics", "label_translated": "Allergic to Penicillin / Antibiotics"},
            {"label": "Allergic to Painkillers (NSAIDs)", "label_translated": "Allergic to Painkillers (NSAIDs)"},
            {"label": "Food / Environmental allergy", "label_translated": "Food / Environmental allergy"},
        ]
    },
    ("known_allergies", "hi-IN"): {
        "spoken_text": "क्या आपको किसी दवा, भोजन या अन्य चीज से एलर्जी है?",
        "suggested_options": [
            {"label": "No known allergies", "label_translated": "कोई एलर्जी नहीं है"},
            {"label": "Allergic to Penicillin / Antibiotics", "label_translated": "एंटीबायोटिक / पेनिसिलिन से एलर्जी"},
            {"label": "Allergic to Painkillers (NSAIDs)", "label_translated": "दर्द निवारक दवा से एलर्जी"},
            {"label": "Food / Environmental allergy", "label_translated": "खाद्य पदार्थ / धूल से एलर्जी"},
        ]
    },

    # ── CHRONIC CONDITIONS ──
    ("chronic_conditions", "en-IN"): {
        "spoken_text": "Do you have any existing chronic health conditions?",
        "suggested_options": [
            {"label": "None / Healthy", "label_translated": "None / Healthy"},
            {"label": "Diabetes (Sugar)", "label_translated": "Diabetes (Sugar)"},
            {"label": "High Blood Pressure (Hypertension)", "label_translated": "High Blood Pressure (Hypertension)"},
            {"label": "Asthma / Breathing issue", "label_translated": "Asthma / Breathing issue"},
            {"label": "Heart condition", "label_translated": "Heart condition"},
            {"label": "Kidney / Thyroid issue", "label_translated": "Kidney / Thyroid issue"},
        ]
    },
    ("chronic_conditions", "hi-IN"): {
        "spoken_text": "क्या आपको डायबिटीज, बीपी या कोई अन्य पुरानी बीमारी है?",
        "suggested_options": [
            {"label": "None / Healthy", "label_translated": "कोई बीमारी नहीं / स्वस्थ"},
            {"label": "Diabetes (Sugar)", "label_translated": "डायबिटीज (शुगर)"},
            {"label": "High Blood Pressure (Hypertension)", "label_translated": "हाई ब्लड प्रेशर (बीपी)"},
            {"label": "Asthma / Breathing issue", "label_translated": "अस्थमा / सांस की समस्या"},
            {"label": "Heart condition", "label_translated": "हृदय (दिल) की बीमारी"},
            {"label": "Kidney / Thyroid issue", "label_translated": "किडनी / थायराइड की समस्या"},
        ]
    },
}


def get_cached_question(field_id: str, language: str) -> dict | None:
    """
    Check if a question is available in the local fast-path cache.
    Returns dict with spoken_text and suggested_options if cached, else None.
    """
    key = (field_id, language)
    if key in FAST_PATH_CACHE:
        logger.info(f"⚡ Fast-Path cache HIT for field='{field_id}', lang='{language}'")
        return FAST_PATH_CACHE[key]
    
    # Try fallback to en-IN if specific language version not available
    fallback_key = (field_id, "en-IN")
    if fallback_key in FAST_PATH_CACHE:
        logger.info(f"⚡ Fast-Path cache HIT (en-IN fallback) for field='{field_id}'")
        return FAST_PATH_CACHE[fallback_key]

    return None
