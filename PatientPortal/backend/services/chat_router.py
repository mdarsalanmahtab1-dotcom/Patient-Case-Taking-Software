"""
INTENT & SAFETY ROUTER FOR SWASTHYASYNC AI
Classifies user intent, intercepts emergency red flags, and isolates small talk.
"""

import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# Emergency red-flag trigger patterns
EMERGENCY_TRIGGERS = [
    r"\b(chest\s*pain|heart\s*attack|crushing\s*chest)\b",
    r"\b(severe\s*shortness\s*of\s*breath|can't\s*breathe|trouble\s*breathing)\b",
    r"\b(unconscious|passed\s*out|fainted|loss\s*of\s*consciousness)\b",
    r"\b(seizure|convulsion|epilepsy\s*fit)\b",
    r"\b(severe\s*bleeding|hemorrhage|coughing\s*blood)\b",
    r"\b(paralysis|facial\s*droop|slurred\s*speech|stroke)\b",
    r"\b(suicid|kill\s*myself|end\s*my\s*life)\b",
    r"\b(anaphylaxis|throat\s*swelling|severe\s*allergic)\b"
]

# Greetings and small-talk patterns
SMALL_TALK_PATTERNS = [
    r"^(hi|hello|hey|greetings|namaste|pranam|halo|hola)[\s!.]*$",
    r"^(good\s*(morning|afternoon|evening|day))[\s!.]*$",
    r"^(how\s*are\s*you|how\s*r\s*u|kaise\s*ho|kemon\s*acho)[\s?.]*$",
    r"^(thank\s*you|thanks|thx|shukriya|dhanyawad|dhonnobad)[\s!.]*$",
    r"^(ok|okay|bye|goodbye|alvida|tata)[\s!.]*$",
    r"^(who\s*are\s*you|what\s*is\s*your\s*name|aap\s*kaun\s*ho)[\s?.]*$"
]

# Personal record intent patterns
PATIENT_RECORD_PATTERNS = [
    r"\bmy\s+(?:last|latest|previous|recent)?\s*(?:report|prescription|medicine|medication|record|history|visit|bp|vitals?|sugar|hemoglobin|creatinine|cbc|diagnosis)\b",
    r"\bwhat\s+(?:did|has)\s+my\s+doctor\s+(?:say|prescribe|advise|note)\b",
    r"\bwhat\s+was\s+my\s+(?:last|latest|previous|recent)?\s*(?:test|visit|blood|report|reading|bp|pressure|result)\b",
    r"\bwhat\s+medicines?\s+(?:am\s+i|did\s+i)\s+(?:taking|prescribed|given)\b",
    r"\bshow\s+(?:my|me)\s+(?:records?|prescriptions?|reports?|history|vitals?)\b",
    r"\b(?:meri|mera)\s+(?:report|dawai|prescription|bimari|test|record)\b",
    r"\bamar\s+(?:report|osudh|daktar|porikkha)\b"
]

# Hospital and Kiosk patterns
KIOSK_PATTERNS = [
    r"\b(kiosk|machine|scanner|swasthya\s*sync|how\s*does\s*(this|it)\s*work|upload\s*report|voice\s*interview)\b",
    r"\b(kiosk\s*kya\s*karta\s*hai|ye\s*machine\s*kya\s*hai)\b"
]

HOSPITAL_PATTERNS = [
    r"\b(department|cardiology|orthopedic|nephrology|ayush|opd|timing|hours|room\s*no|consultant|doctor\s*available)\b",
    r"\b(hospital\s*address|emergency\s*number|hospital\s*services)\b"
]

QUEUE_PATTERNS = [
    r"\b(token|queue|wait\s*time|waiting\s*number|my\s*turn|line|status)\b"
]

# Diet and food patterns
FOOD_PATTERNS = [
    r"\b(can\s*i\s*eat|should\s*i\s*eat|is\s*.*safe\s*to\s*eat|diet|nutrition|banana|coconut\s*water|salt|sugar|food)\b",
    r"\b(kya\s*main\s*.*kha\s*sakta\s*hoon)\b"
]


def classify_intent_and_safety(user_message: str) -> Tuple[str, bool]:
    """
    Returns (intent_string, is_emergency_boolean).
    Intents:
      - EMERGENCY
      - SMALL_TALK
      - PATIENT_RECORD
      - KIOSK_INFO
      - HOSPITAL_INFO
      - QUEUE_STATUS
      - FOOD_AND_DIET
      - GENERAL_HEALTH
    """
    text = user_message.strip().lower()
    
    # 1. Check Emergency First
    for pattern in EMERGENCY_TRIGGERS:
        if re.search(pattern, text, re.IGNORECASE):
            return "EMERGENCY", True
            
    # 2. Check Small Talk
    for pattern in SMALL_TALK_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "SMALL_TALK", False
            
    # 3. Check Queue / Token
    for pattern in QUEUE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "QUEUE_STATUS", False

    # 4. Check Patient Record
    for pattern in PATIENT_RECORD_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "PATIENT_RECORD", False

    # 5. Check Kiosk
    for pattern in KIOSK_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "KIOSK_INFO", False

    # 6. Check Hospital
    for pattern in HOSPITAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "HOSPITAL_INFO", False

    # 7. Check Food / Diet
    for pattern in FOOD_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "FOOD_AND_DIET", False

    # Default to General Health
    return "GENERAL_HEALTH", False


def get_direct_small_talk_reply(user_message: str) -> dict:
    """Generates an immediate, friendly response for common greetings without invoking the LLM."""
    text = user_message.strip().lower()
    
    if any(k in text for k in ["namaste", "pranam"]):
        reply = "नमस्ते! मैं स्वास्थ्यसिंक एआई (SwasthyaSync AI) हूँ। मैं आपके मेडिकल रिकॉर्ड समझने, अस्पताल और कियोस्क की जानकारी देने, या सामान्य स्वास्थ्य सवालों में आपकी मदद कर सकता हूँ। आज मैं आपकी क्या सहायता करूँ?"
    elif any(k in text for k in ["kemon acho", "dhonnobad"]):
        reply = "নমস্কার! আমি ভালো আছি। আমি স্বাচ্ছন্দ্যে আপনার প্রেসক্রিপশন, ল্যাব রিপোর্ট বা হাসপাতালের সেবা সংক্রান্ত তথ্য বুঝতে সাহায্য করতে পারি। আপনি কি জানতে চান?"
    elif any(k in text for k in ["kaise ho", "kya haal"]):
        reply = "नमस्ते! मैं बिल्कुल ठीक हूँ। मैं आपके मेडिकल रिकॉर्ड देखने, डॉक्टर की सलाह समझाने, या अस्पताल की जानकारी देने के लिए यहाँ हूँ। बताइए, आज आपकी क्या सहायता करूँ?"
    elif any(k in text for k in ["thank", "shukriya"]):
        reply = "You're very welcome! If you have any more questions about your reports, medications, or hospital services, feel free to ask."
    elif any(k in text for k in ["bye", "goodbye", "alvida"]):
        reply = "Take good care of your health! Have a wonderful day ahead."
    else:
        reply = "Hello! I'm SwasthyaSync AI. I can help you understand your available medical records, explain lab reports and prescriptions, answer hospital and kiosk questions, or guide you on general health. How can I help you today?"
        
    return {
        "intent": "SMALL_TALK",
        "response": reply,
        "sources": [{"type": "general_greeting", "label": "SwasthyaSync AI"}],
        "confidence": "high",
        "needs_clinician": False,
        "emergency": False,
        "suggested_followups": [
            "What medications was I prescribed?",
            "What does the SwasthyaSync kiosk do?",
            "Where is the Cardiology department?"
        ]
    }
