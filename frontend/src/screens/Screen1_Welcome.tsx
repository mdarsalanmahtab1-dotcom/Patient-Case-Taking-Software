import { LiquidButton } from '../components/ui/button';
import { useState, useEffect } from 'react';
import { Globe, Volume2, ArrowRight, Phone } from 'lucide-react';
import { toast } from '../components/Toast';
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBaseUrl } from '../config';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
  onStart: (clinicMode: string, language: string, patientData: any) => void;
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
  'en-IN': 'Welcome to SwasthyaSync. Please select your language to begin.',
  'hi-IN': 'SwasthyaSync में आपका स्वागत है। शुरू करने के लिए अपनी भाषा चुनें।',
  'ta-IN': 'SwasthyaSync க்கு வரவேற்கிறோம். தொடங்க உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்.',
  'te-IN': 'SwasthyaSync కు స్వాగతం. ప్రారంభించడానికి మీ భాషను ఎంచుకోండి.',
  'kn-IN': 'SwasthyaSync ಗೆ ಸ್ವಾಗತ. ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ.',
  'bn-IN': 'SwasthyaSync এ আপনাকে স্বাগতম। শুরু করতে আপনার ভাষা নির্বাচন করুন।',
  'mr-IN': 'SwasthyaSync मध्ये आपले स्वागत आहे। सुरू करण्यासाठी आपली भाषा निवडा।',
  'gu-IN': 'SwasthyaSync માં આપનું સ્વાગત છે। શરૂ કરવા માટે તમારી ભાષા પસંદ કરો.',
  'ml-IN': 'SwasthyaSync-ലേക്ക് സ്വാഗതം. ആരംഭിക്കാൻ നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.',
  'pa-IN': 'SwasthyaSync ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ।',
};

export function Screen1_Welcome({ onStart, isConnected }: Props) {
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [clinicMode, setClinicMode] = useState('allopathic');
  const [phone, setPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const { speak, isSpeaking } = useSarvamTTS();
  const { t } = useTranslation();

  // Auto-greet in selected language when language changes
  useEffect(() => {
    const greeting = GREETINGS[selectedLang] || GREETINGS['en-IN'];
    speak(greeting, selectedLang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLang]);

  const handleReplayGreeting = () => {
    const greeting = GREETINGS[selectedLang] || GREETINGS['en-IN'];
    speak(greeting, selectedLang);
  };

  const handleStart = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    setIsLookingUp(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/patient/lookup-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      if (res.ok) {
        const patientData = await res.json();
        onStart(clinicMode, selectedLang, patientData);
      } else {
        toast.error("Error looking up patient. Please try again.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error connecting to backend.");
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center p-4 sm:p-12 text-center relative w-full min-h-[100%] pb-24"
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-50/60 to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="z-10 w-full max-w-4xl flex flex-col items-center mt-1 sm:mt-2"
      >
        <h1 className="text-3xl sm:text-6xl font-extrabold mb-1 sm:mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 pb-1">
          SwasthyaSync
        </h1>
        
        {/* Animated Greeting with directional smoothness */}
        <div className="min-h-[3rem] sm:min-h-[3.5rem] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p 
              key={selectedLang}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="text-sm sm:text-xl text-slate-600 max-w-2xl font-medium leading-relaxed px-2"
            >
              {GREETINGS[selectedLang] || t('welcome.subtitle')}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
        className="z-10 w-full max-w-4xl flex flex-col items-center bg-white/95 backdrop-blur-2xl border border-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl shadow-slate-200/50"
      >
        {/* Language Selection */}
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-blue-500" />
          {t('welcome.select_language')}
        </p>
        
        {/* Staggered Language Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 w-full mb-5">
          {LANGUAGES.map((lang, idx) => (
            <motion.div
              key={lang.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 + idx * 0.025, ease: [0.16, 1, 0.3, 1] }}
            >
              <LiquidButton
                id={`lang-${lang.code}`}
                onClick={() => setSelectedLang(lang.code)}
                className={`relative overflow-hidden w-full flex flex-col items-center justify-center py-2.5 sm:py-4 px-1.5 sm:px-2 rounded-xl sm:rounded-2xl border-2 transition-[transform,border-color,background-color,box-shadow] duration-150 transform active:scale-[0.97] hover:-translate-y-0.5 cursor-pointer ${
                  selectedLang === lang.code
                    ? 'border-blue-600 bg-blue-600 text-white shadow-card-hover ring-2 ring-blue-600/20'
                    : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:shadow-card'
                }`}
              >
                <div className="text-base sm:text-xl font-extrabold leading-tight mb-0.5">{lang.native}</div>
                <div className={`text-xs font-semibold tracking-wide ${selectedLang === lang.code ? 'text-blue-100' : 'text-slate-500'}`}>
                  {lang.name}
                </div>
              </LiquidButton>
            </motion.div>
          ))}
        </div>

        {/* Clinic Mode */}
        <div className="flex flex-col items-center w-full max-w-lg">
           <div className="flex w-full max-w-[180px] sm:max-w-[200px] bg-slate-100/90 p-1 rounded-full mb-3 sm:mb-4 border border-slate-200/50 shadow-inner">
            {['allopathic', 'ayush'].map((mode) => (
              <LiquidButton
                key={mode}
                id={`mode-${mode}`}
                onClick={() => setClinicMode(mode)}
                className={`flex-1 py-1 sm:py-1.5 rounded-full text-xs font-bold capitalize transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                  clinicMode === mode
                    ? 'bg-white text-slate-900 shadow-card ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode}
              </LiquidButton>
            ))}
          </div>

          <div className="w-full bg-slate-50/70 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-inner border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:bg-white focus-within:shadow-card transition-[border-color,background-color,box-shadow] duration-200 mb-4 sm:mb-6 group cursor-text">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5 group-focus-within:text-blue-600 transition-colors">
              <Phone className="w-3 h-3" />
              {t('welcome.enter_mobile')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="00000 00000"
              className="w-full bg-transparent border-none text-2xl sm:text-4xl font-extrabold text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 p-0 tracking-wider sm:tracking-widest cursor-text"
            />
          </div>

          <LiquidButton
            id="btn-start"
            onClick={handleStart}
            disabled={!isConnected || isLookingUp || phone.length < 10}
            className="group relative w-full overflow-hidden bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-full py-3.5 sm:py-4 font-extrabold shadow-card-hover transition-[transform,background-color,box-shadow] duration-150 transform hover:-translate-y-0.5 active:scale-[0.97] text-base sm:text-lg flex items-center justify-center gap-3 cursor-pointer border border-transparent disabled:border-slate-200"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isLookingUp ? t('welcome.looking_up') : !isConnected ? t('welcome.connecting') : t('welcome.start_checkin')}
              {isConnected && !isLookingUp && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1.5 transition-transform" />}
            </span>
          </LiquidButton>
        </div>

        {/* TTS replay button */}
        <LiquidButton
          id="btn-replay-greeting"
          onClick={handleReplayGreeting}
          className="mt-3 sm:mt-4 flex items-center gap-2 text-slate-600 hover:text-slate-800 font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.97] bg-slate-100 hover:bg-slate-200 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs cursor-pointer shadow-2xs"
        >
          <Volume2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSpeaking ? 'text-blue-500 animate-pulse' : ''}`} />
          {isSpeaking ? t('welcome.speaking') : t('welcome.tap_to_hear')}
        </LiquidButton>
      </motion.div>
    </motion.div>
  );
}
