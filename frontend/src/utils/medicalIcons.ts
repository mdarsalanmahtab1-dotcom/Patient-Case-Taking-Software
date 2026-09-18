/**
 * SwasthyaSync — Medical Icon & Emoji Resolver for Kiosk Touch UI
 * 
 * Designed for public healthcare kiosks to empower non-formally educated
 * and multilingual patients with instant visual and tactile comprehension.
 */

export interface MedicalVisual {
  emoji: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  theme: 'blue' | 'red' | 'emerald' | 'amber' | 'purple' | 'slate';
}

const DEFAULT_VISUAL: MedicalVisual = {
  emoji: '🩺',
  badgeBg: 'bg-blue-50',
  badgeBorder: 'border-blue-200',
  badgeText: 'text-blue-700',
  theme: 'blue',
};

interface Rule {
  keywords: string[];
  visual: MedicalVisual;
}

const RULES: Rule[] = [
  // Uncertainty / Neutral (Checked FIRST to avoid 'not sure' matching 'sure')
  {
    keywords: ['not sure', 'dont know', "don't know", 'pata nahi', 'पता नहीं', 'জানিনা', 'maybe', 'uncertain', 'unclear'],
    visual: { emoji: '🤔', badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-200', badgeText: 'text-amber-700', theme: 'amber' },
  },
  // Negative
  {
    keywords: ['no', 'nahi', 'nahin', 'नहीं', 'না', 'never', 'none', 'false', 'absent', 'no rash', 'no fever', 'no pain'],
    visual: { emoji: '❌', badgeBg: 'bg-rose-50', badgeBorder: 'border-rose-200', badgeText: 'text-rose-700', theme: 'red' },
  },
  // Affirmative
  {
    keywords: ['yes', 'haan', 'हाँ', 'हां', 'হ্যাঁ', 'correct', 'true', 'present', 'noticed'],
    visual: { emoji: '✅', badgeBg: 'bg-emerald-50', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-700', theme: 'emerald' },
  },
  // Other / Open
  {
    keywords: ['something else', 'other', 'kuch aur', 'कुछ और', 'অন্য কিছু', 'else'],
    visual: { emoji: '➕', badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-200', badgeText: 'text-indigo-700', theme: 'purple' },
  },

  // Severity
  {
    keywords: ['severe', 'high', 'extreme', 'intense', 'तेज', 'गंभीर', 'तীব্র', 'heavy'],
    visual: { emoji: '🔴', badgeBg: 'bg-red-50', badgeBorder: 'border-red-200', badgeText: 'text-red-700', theme: 'red' },
  },
  {
    keywords: ['moderate', 'medium', 'madhyam', 'मध्यम'],
    visual: { emoji: '🟡', badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-200', badgeText: 'text-amber-700', theme: 'amber' },
  },
  {
    keywords: ['mild', 'low', 'slight', 'halka', 'हल्का', 'हल्की', 'সামান্য'],
    visual: { emoji: '🟢', badgeBg: 'bg-emerald-50', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-700', theme: 'emerald' },
  },

  // Primary Clinical Symptoms
  {
    keywords: ['fever', 'bukhar', 'tap', 'बुखार', 'ज्वर', 'জ্বর', 'chills', 'shivering', 'shiver', 'comp'],
    visual: { emoji: '🌡️', badgeBg: 'bg-red-50', badgeBorder: 'border-red-200', badgeText: 'text-red-700', theme: 'red' },
  },
  {
    keywords: ['headache', 'head ache', 'sir dard', 'सिरदर्द', 'মাথাব্যথা', 'migraine'],
    visual: { emoji: '🤕', badgeBg: 'bg-purple-50', badgeBorder: 'border-purple-200', badgeText: 'text-purple-700', theme: 'purple' },
  },
  {
    keywords: ['pain', 'dard', 'ache', 'hurts', 'दर्द', 'ব্যথা', 'cramp'],
    visual: { emoji: '⚡', badgeBg: 'bg-orange-50', badgeBorder: 'border-orange-200', badgeText: 'text-orange-700', theme: 'amber' },
  },
  {
    keywords: ['cough', 'khasi', 'khansi', 'खांसी', 'काশি', 'phlegm', 'sputum'],
    visual: { emoji: '🗣️', badgeBg: 'bg-blue-50', badgeBorder: 'border-blue-200', badgeText: 'text-blue-700', theme: 'blue' },
  },
  {
    keywords: ['cold', 'jukham', 'zukam', 'जुकाम', 'ঠান্ডা', 'sneezing', 'runny nose'],
    visual: { emoji: '🤧', badgeBg: 'bg-cyan-50', badgeBorder: 'border-cyan-200', badgeText: 'text-cyan-700', theme: 'blue' },
  },
  {
    keywords: ['stomach', 'pet', 'abdominal', 'belly', 'पेट', 'পেট', 'gastric', 'acidity', 'gas'],
    visual: { emoji: '🤢', badgeBg: 'bg-emerald-50', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-700', theme: 'emerald' },
  },
  {
    keywords: ['vomit', 'vomiting', 'ulti', 'उल्टी', 'বমি', 'nausea', 'ji machlana'],
    visual: { emoji: '🤮', badgeBg: 'bg-lime-50', badgeBorder: 'border-lime-200', badgeText: 'text-lime-700', theme: 'emerald' },
  },
  {
    keywords: ['diarrhea', 'loose motion', 'dast', 'दस्त', 'ডায়রিয়া', 'pet kharab'],
    visual: { emoji: '🚽', badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-200', badgeText: 'text-amber-700', theme: 'amber' },
  },
  {
    keywords: ['breath', 'breathing', 'shortness', 'sans', 'saans', 'सांस', 'শ্বাসকষ্ট', 'asthma', 'wheezing'],
    visual: { emoji: '🫁', badgeBg: 'bg-teal-50', badgeBorder: 'border-teal-200', badgeText: 'text-teal-700', theme: 'blue' },
  },
  {
    keywords: ['chest pain', 'chest', 'chhati', 'seena', 'छाती', 'বুক', 'heart', 'dil', 'palpitations'],
    visual: { emoji: '💔', badgeBg: 'bg-rose-50', badgeBorder: 'border-rose-200', badgeText: 'text-rose-700', theme: 'red' },
  },
  {
    keywords: ['weakness', 'fatigue', 'tired', 'kamjori', 'kamzori', 'कमजोरी', 'দুর্বলতা', 'lethargy'],
    visual: { emoji: '🥱', badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-200', badgeText: 'text-amber-700', theme: 'amber' },
  },
  {
    keywords: ['skin', 'rash', 'itching', 'khujli', 'twacha', 'त्वचा', 'চামড়া', 'allergy', 'boil'],
    visual: { emoji: '🩹', badgeBg: 'bg-pink-50', badgeBorder: 'border-pink-200', badgeText: 'text-pink-700', theme: 'red' },
  },
  {
    keywords: ['eye', 'eyes', 'aankh', 'आंख', 'চোখ', 'vision', 'red eye', ' जलन'],
    visual: { emoji: '👁️', badgeBg: 'bg-sky-50', badgeBorder: 'border-sky-200', badgeText: 'text-sky-700', theme: 'blue' },
  },
  {
    keywords: ['ear', 'kaan', 'कान', 'কান', 'hearing', 'throat', 'gala', 'गला', 'গলা'],
    visual: { emoji: '👂', badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-200', badgeText: 'text-indigo-700', theme: 'purple' },
  },
  {
    keywords: ['dizzy', 'dizziness', 'chakkar', 'चक्कर', 'মাথা ঘোরা', 'vertigo', 'faint'],
    visual: { emoji: '💫', badgeBg: 'bg-violet-50', badgeBorder: 'border-violet-200', badgeText: 'text-violet-700', theme: 'purple' },
  },
  {
    keywords: ['blood', 'bleeding', 'khoon', 'खून', 'রক্ত'],
    visual: { emoji: '🩸', badgeBg: 'bg-red-50', badgeBorder: 'border-red-200', badgeText: 'text-red-700', theme: 'red' },
  },
  {
    keywords: ['swelling', 'soojan', 'sujan', 'सूजन', 'ফোলা', 'edema'],
    visual: { emoji: '🦵', badgeBg: 'bg-orange-50', badgeBorder: 'border-orange-200', badgeText: 'text-orange-700', theme: 'amber' },
  },
  {
    keywords: ['sleep', 'insomnia', 'neend', 'नींद', 'ঘুম'],
    visual: { emoji: '😴', badgeBg: 'bg-slate-50', badgeBorder: 'border-slate-200', badgeText: 'text-slate-700', theme: 'slate' },
  },

  // Timing & Duration
  {
    keywords: ['today', 'now', 'aaj', 'आज', 'আজকে', 'recently'],
    visual: { emoji: '⏱️', badgeBg: 'bg-blue-50', badgeBorder: 'border-blue-200', badgeText: 'text-blue-700', theme: 'blue' },
  },
  {
    keywords: ['days', 'din', 'दिन', 'দিন'],
    visual: { emoji: '📅', badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-200', badgeText: 'text-indigo-700', theme: 'purple' },
  },
  {
    keywords: ['weeks', 'hafta', 'hafte', 'हफ्ते', 'সপ্তাহ'],
    visual: { emoji: '🗓️', badgeBg: 'bg-purple-50', badgeBorder: 'border-purple-200', badgeText: 'text-purple-700', theme: 'purple' },
  },
  {
    keywords: ['months', 'mahina', 'mahine', 'महीने', 'মাস'],
    visual: { emoji: '📆', badgeBg: 'bg-slate-50', badgeBorder: 'border-slate-200', badgeText: 'text-slate-700', theme: 'slate' },
  },
  {
    keywords: ['better', 'improving', 'sudhar', 'सुधार', 'ভালো'],
    visual: { emoji: '📈', badgeBg: 'bg-emerald-50', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-700', theme: 'emerald' },
  },
  {
    keywords: ['worse', 'kharab', 'bad', 'खराब', 'খারাপ'],
    visual: { emoji: '📉', badgeBg: 'bg-rose-50', badgeBorder: 'border-rose-200', badgeText: 'text-rose-700', theme: 'red' },
  },
];

export function getMedicalOptionVisual(label: string, labelTranslated?: string): MedicalVisual {
  const textToScan = `${label || ''} ${labelTranslated || ''}`.toLowerCase().trim();
  const words = textToScan.split(/[\s,.\-\(\)]+/).filter(Boolean);

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const lowerKw = kw.toLowerCase().trim();
      // If kw has spaces (e.g. 'not sure', 'something else'), check phrase match
      if (lowerKw.includes(' ')) {
        if (textToScan.includes(lowerKw)) {
          return rule.visual;
        }
      } else {
        // Single word: must match whole word or prefix if length >= 4
        if (words.includes(lowerKw) || (lowerKw.length >= 4 && textToScan.includes(lowerKw))) {
          return rule.visual;
        }
      }
    }
  }

  return DEFAULT_VISUAL;
}
