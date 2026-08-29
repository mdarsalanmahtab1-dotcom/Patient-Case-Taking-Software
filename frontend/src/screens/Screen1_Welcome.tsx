import { useState, useEffect, useRef } from 'react';
import { Globe, Volume2 } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';
import { useSarvamTTS } from '../hooks/useSarvamTTS';

interface Props {
  onStart: (clinicMode: string, language: string) => void;
  isConnected: boolean;
}

// All 10 Indian languages supported by Sarvam AI
const LANGUAGES = [
  { code: 'en-IN', name: 'English',  native: 'English'   },
  { code: 'hi-IN', name: 'Hindi',    native: 'हिंदी'       },
  { code: 'ta-IN', name: 'Tamil',    native: 'தமிழ்'      },
  { code: 'te-IN', name: 'Telugu',   native: 'తెలుగు'     },
  { code: 'kn-IN', name: 'Kannada',  native: 'ಕನ್ನಡ'      },
  { code: 'bn-IN', name: 'Bengali',  native: 'বাংলা'      },
  { code: 'mr-IN', name: 'Marathi',  native: 'मराठी'      },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી'    },
  { code: 'ml-IN', name: 'Malayalam',native: 'മലയാളം'     },
  { code: 'pa-IN', name: 'Punjabi',  native: 'ਪੰਜਾਬੀ'    },
];

// Welcome greeting per language
const GREETINGS: Record<string, string> = {
  'en-IN': 'Welcome to MediKiosk. Please select your language to begin.',
  'hi-IN': 'मेडीकियोस्क में आपका स्वागत है। शुरू करने के लिए अपनी भाषा चुनें।',
  'ta-IN': 'மெடிகியோஸ்க்கிற்கு வரவேற்கிறோம். தொடங்க உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்।',
  'te-IN': 'మెడీకియోస్క్‌కు స్వాగతం. ప్రారంభించడానికి మీ భాషను ఎంచుకోండి.',
  'kn-IN': 'ಮೆಡಿಕಿಯೋಸ್ಕ್‌ಗೆ ಸ್ವಾಗತ. ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ.',
  'bn-IN': 'মেডিকিওস্কে আপনাকে স্বাগতম। শুরু করতে আপনার ভাষা নির্বাচন করুন।',
  'mr-IN': 'मेडीकियोस्कमध्ये आपले स्वागत आहे। सुरू करण्यासाठी आपली भाषा निवडा।',
  'gu-IN': 'મેડીકિઓસ્કમાં આપનું સ્વાગત છે। શરૂ કરવા માટે તમારી ભાષા પસંદ કરો.',
  'ml-IN': 'മെഡിക്കിയോസ്‌കിലേക്ക് സ്വാഗതം. ആരംഭിക്കാൻ നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.',
  'pa-IN': 'ਮੈਡੀਕਿਓਸਕ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ।',
};

export function Screen1_Welcome({ onStart, isConnected }: Props) {
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [clinicMode, setClinicMode] = useState('allopathic');
  const { speak, isSpeaking } = useSarvamTTS();

  const isFirstRender = useRef(true);

  // Auto-greet in selected language when language changes (but not on initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const greeting = GREETINGS[selectedLang] || GREETINGS['en-IN'];
    speak(greeting, selectedLang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLang]);

  const handleReplayGreeting = () => {
    const greeting = GREETINGS[selectedLang] || GREETINGS['en-IN'];
    speak(greeting, selectedLang);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MediKiosk</h2>
      <p className="text-gray-500 mb-6">
        {GREETINGS[selectedLang] || 'Your health, our priority'}
      </p>

      <div className="mb-8 relative">
        <AbstractOrb interactionState={isSpeaking ? 'speaking' : 'idle'} />
      </div>

      {/* Language Selection — all 10 Sarvam-supported languages */}
      <p className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Select your preferred language / अपनी भाषा चुनें
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full max-w-2xl mb-8">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            id={`lang-${lang.code}`}
            onClick={() => setSelectedLang(lang.code)}
            className={`py-3 px-3 rounded-xl border-2 transition-all ${
              selectedLang === lang.code
                ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <div className="text-lg leading-tight">{lang.native}</div>
            <div className={`text-xs mt-0.5 ${selectedLang === lang.code ? 'text-blue-100' : 'text-gray-400'}`}>
              {lang.name}
            </div>
          </button>
        ))}
      </div>

      {/* Clinic Mode */}
      <p className="text-xs text-gray-400 mb-2">Department mode (resolved from appointment)</p>
      <div className="flex gap-3 mb-8">
        {['allopathic', 'ayush'].map((mode) => (
          <button
            key={mode}
            id={`mode-${mode}`}
            onClick={() => setClinicMode(mode)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              clinicMode === mode
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        id="btn-start"
        onClick={() => onStart(clinicMode, selectedLang)}
        disabled={!isConnected}
        className="w-full max-w-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl py-4 font-semibold shadow-lg shadow-blue-200 transition-all transform active:scale-95 text-lg"
      >
        {isConnected ? 'Start Check-In' : 'Connecting to server...'}
      </button>

      {/* TTS replay button */}
      <button
        id="btn-replay-greeting"
        onClick={handleReplayGreeting}
        className="mt-6 flex items-center gap-2 text-blue-600 font-medium hover:underline"
      >
        <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
        {isSpeaking ? 'Speaking...' : 'Tap to hear in selected language'}
      </button>
    </div>
  );
}
