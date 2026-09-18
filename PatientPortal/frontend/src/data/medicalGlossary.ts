export interface GlossaryTerm {
  term: string;
  category: 'Condition' | 'Medication' | 'Symptom' | 'Vitals';
  meaning: {
    en: string;
    hi: string;
    bn: string;
  };
}

export const MEDICAL_GLOSSARY: Record<string, GlossaryTerm> = {
  "hypertension": {
    term: "Hypertension (High BP)",
    category: "Condition",
    meaning: {
      en: "High blood pressure — when the force of blood against your artery walls is consistently higher than normal (>130/80 mmHg).",
      hi: "उच्च रक्तचाप — जब धमनियों में रक्त का दबाव सामान्य से लगातार अधिक रहता है।",
      bn: "উচ্চ রক্তচাপ — যখন ধমনীতে রক্তচাপ স্বাভাবিকের চেয়ে বেশি থাকে।"
    }
  },
  "hypotension": {
    term: "Hypotension (Low BP)",
    category: "Condition",
    meaning: {
      en: "Low blood pressure — when blood pressure drops below 90/60 mmHg, which may cause dizziness or fainting.",
      hi: "निम्न रक्तचाप — जब रक्तचाप कम हो जाए, जिससे चक्कर या कमजोरी आ सकती है।",
      bn: "নিম্ন রক্তচাপ — যখন রক্তচাপ কমে যায়, যার ফলে মাথা ঘোরা হতে পারে।"
    }
  },
  "tachycardia": {
    term: "Tachycardia",
    category: "Vitals",
    meaning: {
      en: "Rapid resting heart rate (typically over 100 beats per minute).",
      hi: "हृदय गति का तेज होना (प्रति मिनट 100 धड़कन से अधिक)।",
      bn: "হৃদস্পন্দন দ্রুত হওয়া (প্রতি মিনিটে ১০০ এর বেশি)।"
    }
  },
  "bradycardia": {
    term: "Bradycardia",
    category: "Vitals",
    meaning: {
      en: "Slow resting heart rate (typically under 60 beats per minute).",
      hi: "हृदय गति का धीमा होना (प्रति मिनट 60 धड़कन से कम)।",
      bn: "হৃদস্পন্দন ধীর হওয়া (প্রতি মিনিটে ৬০ এর কম)।"
    }
  },
  "dyspnea": {
    term: "Dyspnea",
    category: "Symptom",
    meaning: {
      en: "Shortness of breath or difficulty breathing comfortably.",
      hi: "सांस लेने में तकलीफ या सांस फूलना।",
      bn: "শ্বাসকষ্ট বা শ্বাস নিতে অসুবিধা হওয়া।"
    }
  },
  "edema": {
    term: "Edema",
    category: "Symptom",
    meaning: {
      en: "Swelling caused by excess fluid trapped in the body's tissues (commonly in feet, ankles, or legs).",
      hi: "शरीर के ऊतकों में तरल जमा होने से होने वाली सूजन (जैसे पैरों में)।",
      bn: "শরীরে জল জমে ফুলে যাওয়া (বিশেষ করে পায়ে বা গোড়ালিতে)।"
    }
  },
  "pyrexia": {
    term: "Pyrexia (Fever)",
    category: "Symptom",
    meaning: {
      en: "Elevated body temperature above 98.6°F (37°C), usually in response to infection.",
      hi: "बुखार — शरीर का तापमान सामान्य से अधिक होना।",
      bn: "জ্বর — শরীরের তাপমাত্রা স্বাভাবিকের চেয়ে বৃদ্ধি পাওয়া।"
    }
  },
  "analgesic": {
    term: "Analgesic",
    category: "Medication",
    meaning: {
      en: "Painkiller medication (e.g. Paracetamol, Ibuprofen) used to relieve aches and pain.",
      hi: "दर्द निवारक दवा (जैसे पैरासिटामोल) जो दर्द कम करने के लिए दी जाती है।",
      bn: "ব্যথানাশক ওষুধ (যেমন প্যারাসিটামল) যা ব্যথা কমাতে সাহায্য করে।"
    }
  },
  "antipyretic": {
    term: "Antipyretic",
    category: "Medication",
    meaning: {
      en: "A medicine that reduces fever and lowers body temperature.",
      hi: "बुखार कम करने वाली दवा।",
      bn: "জ্বর কমানোর ওষুধ।"
    }
  },
  "antibiotic": {
    term: "Antibiotic",
    category: "Medication",
    meaning: {
      en: "Medicines that fight bacterial infections. Always complete the full prescribed course.",
      hi: "बैक्टीरियल संक्रमण से लड़ने वाली दवाएं। इसका पूरा कोर्स लेना आवश्यक है।",
      bn: "ব্যাকটেরিয়াজনিত সংক্রমণ প্রতিরোধের ওষুধ। পুরো কোর্স সম্পন্ন করা জরুরি।"
    }
  },
  "antihistamine": {
    term: "Antihistamine",
    category: "Medication",
    meaning: {
      en: "Medicine used to treat allergy symptoms such as sneezing, itching, runny nose, or rashes.",
      hi: "एलर्जी की दवा जो छींक, खुजली और नाक बहने से राहत देती है।",
      bn: "অ্যালার্জির ওষুধ যা হাঁচি, চুলকানি বা সর্দি কমাতে ব্যবহৃত হয়।"
    }
  },
  "gastritis": {
    term: "Gastritis",
    category: "Condition",
    meaning: {
      en: "Inflammation or irritation of the stomach lining, often causing burning stomach pain.",
      hi: "पेट की परत में सूजन या जलन (गैस और एसिडिटी)।",
      bn: "পাকস্থলীর প্রদাহ বা গ্যাস ও অ্যাসিডিটির সমস্যা।"
    }
  },
  "erythema": {
    term: "Erythema",
    category: "Symptom",
    meaning: {
      en: "Redness of the skin caused by increased blood flow in superficial capillaries.",
      hi: "त्वचा का लाल होना या चकत्ते पड़ना।",
      bn: "ত্বক লাল হয়ে যাওয়া বা র্যাশ।"
    }
  },
  "diabetes": {
    term: "Diabetes Mellitus",
    category: "Condition",
    meaning: {
      en: "A chronic condition where the body cannot properly regulate blood sugar (glucose) levels.",
      hi: "मधुमेह (डायबिटीज) — रक्त में शर्करा की मात्रा का अनियंत्रित होना।",
      bn: "ডায়াবেটিস — রক্তে শর্করার মাত্রা বেড়ে যাওয়া।"
    }
  },
  "spo2": {
    term: "SpO2 (Oxygen Saturation)",
    category: "Vitals",
    meaning: {
      en: "The percentage of oxygen carried in your blood. Normal resting range is 95%–100%.",
      hi: "रक्त में ऑक्सीजन का स्तर। सामान्य स्तर 95% से 100% होना चाहिए।",
      bn: "রক্তে অক্সিজেনের মাত্রা। স্বাভাবিক মাত্রা ৯৫% থেকে ১০০%।"
    }
  }
};
