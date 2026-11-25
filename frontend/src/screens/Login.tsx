import { LiquidButton } from '../components/ui/button';
import { useTranslation } from '../hooks/useTranslation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Users, UserPlus, Building2, ArrowRight, User,
  MapPin, Globe, Shield, ShieldCheck, CheckCircle2, Fingerprint, Smartphone,
  BadgeCheck, RefreshCw, ArrowLeft, ChevronRight, AlertCircle, Loader2, UserCircle,
  Mic, FileSearch, HeartPulse, Ticket, Volume2, VolumeX,
  Scan, Stethoscope, Baby, Bone, Siren, Leaf, Minus, Plus, ChevronDown
} from 'lucide-react';
import { getApiBaseUrl } from '../config';
import { OtpInput } from '../components/OtpInput';
import { NumericKeypad } from '../components/NumericKeypad';
import { Field, inputClass } from '../components/ui/field';
import { Skeleton, ErrorState } from '../components/ui/states';
import { toast } from '../components/Toast';
import { useResendCooldown } from '../hooks/useResendCooldown';
import { useAudioGuide } from '../hooks/useAudioGuide';
import type { TranslationKey } from '../utils/audioTranslations';

// ── Profile picture imports ───────────────────────────────────────────
import pfp1 from '../assets/pfp1.jpg';
import pfp2 from '../assets/pfp2.jpg';
import pfp3 from '../assets/pfp3.jpg';
import pfp4 from '../assets/pfp4.jpg';

const PFP_MAP: Record<number, string> = { 1: pfp1, 2: pfp2, 3: pfp3, 4: pfp4 };

// ── Types ─────────────────────────────────────────────────────────────
interface Patient {
  patient_id?: string;
  full_name?: string;
  phone_number: string;
  age?: number | null;
  gender?: string;
  date_of_birth?: string;
  weight?: number | null;
  height?: string;
  vitals?: string;
  address?: string;
  abha_id?: string;
  last_visit?: {
    chief_complaint?: string;
    completed_at?: string;
    department?: string;
  } | null;
}

interface AbdmProfile {
  abha_id: string;
  abha_number_masked: string;
  name: string;
  gender: string;           // "M" or "F"
  gender_display: string;
  dob: string;
  age: number;
  mobile: string;
  address: string;
  blood_group: string;
  pfp_index: number;        // 1-4
  verified: boolean;
}

type Step =
  | 'WELCOME_LANGUAGE'
  | 'CONSENT'
  | 'LANDING'
  | 'ABHA_IDENTIFY'
  | 'ABHA_OTP'
  | 'ABHA_PROFILE_CONFIRM'
  | 'PHONE'
  | 'MOBILE_OTP_VERIFY'
  | 'SELECT_MEMBER'
  | 'REGISTER'
  | 'DEPARTMENT';

// ── Welcome Screen Configurations ─────────────────────────────────────
interface WelcomeLangItem {
  id: 'en' | 'hi' | 'bn';
  ttsLang: 'en-IN' | 'hi-IN' | 'bn-IN';
  label: string;
  native: string;
  sub: string;
  badge: string;
  accent: string;
  borderActive: string;
  welcomePrompt: string;
}

const KIOSK_LANGUAGES: WelcomeLangItem[] = [
  {
    id: 'en',
    ttsLang: 'en-IN',
    label: 'English',
    native: 'English',
    sub: 'Touch to proceed in English',
    badge: 'Standard',
    accent: 'from-blue-600 to-indigo-600',
    borderActive: 'border-blue-500 ring-4 ring-blue-500/20 shadow-blue-500/20',
    welcomePrompt: 'Welcome to SwasthyaSync. Please touch your preferred language on the screen to begin your clinical check-in.',
  },
  {
    id: 'hi',
    ttsLang: 'hi-IN',
    label: 'Hindi',
    native: 'हिन्दी',
    sub: 'हिन्दी में जारी रखने के लिए स्पर्श करें',
    badge: 'राष्ट्रीय',
    accent: 'from-emerald-600 to-teal-600',
    borderActive: 'border-emerald-500 ring-4 ring-emerald-500/20 shadow-emerald-500/20',
    welcomePrompt: 'स्वास्थ्यसिंक में आपका स्वागत है। अपनी स्वास्थ्य जांच और टोकन प्राप्त करने के लिए कृपया स्क्रीन पर अपनी भाषा चुनें।',
  },
  {
    id: 'bn',
    ttsLang: 'bn-IN',
    label: 'Bengali',
    native: 'বাংলা',
    sub: 'বাংলা ভাষায় শুরু করতে স্পর্শ করুন',
    badge: 'আঞ্চলিক',
    accent: 'from-amber-600 to-orange-600',
    borderActive: 'border-amber-500 ring-4 ring-amber-500/20 shadow-amber-500/20',
    welcomePrompt: 'স্বাস্থ্যসিঙ্কে আপনাকে স্বাগতম। আপনার স্বাস্থ্য পরীক্ষা শুরু করতে অনুগ্রহ করে স্ক্রিনে আপনার ভাষা নির্বাচন করুন।',
  },
];

interface Props {
  onSessionStarted: (sessionData: any, patientData: Patient, language: string) => void;
  isConnected: boolean;
}

// ── Consent items ─────────────────────────────────────────────────────
const CONSENT_ITEMS = [
  {
    key: 'health_data',
    text: 'I consent to SwasthyaSync capturing my health history (voice & text) for this consultation.',
    subtext: 'Includes symptom intake and clinical assessment.',
    audioKey: 'consent_explain_health_data' as TranslationKey,
  },
  {
    key: 'document_extract',
    text: 'I authorize extraction of health information from documents I upload to this system.',
    subtext: 'Prescriptions, lab reports and medical records.',
    audioKey: 'consent_explain_document_extract' as TranslationKey,
  },
  {
    key: 'data_sharing',
    text: 'I permit secure sharing of my health data with the assigned doctor under the DPDP Act 2023.',
    subtext: 'Data is never shared with third parties without your consent.',
    audioKey: 'consent_explain_data_sharing' as TranslationKey,
  },
] as const;

type ConsentKey = typeof CONSENT_ITEMS[number]['key'];

// ── Kiosk progress (Consent → Department) ────────────────────────────
const KIOSK_STEPS = ['Consent', 'Identify', 'Verify', 'Profile', 'Department'] as const;

function kioskStepIndex(step: Step): number {
  if (step === 'CONSENT') return 0;
  if (['LANDING', 'ABHA_IDENTIFY', 'PHONE'].includes(step)) return 1;
  if (['ABHA_OTP', 'MOBILE_OTP_VERIFY'].includes(step)) return 2;
  if (['ABHA_PROFILE_CONFIRM', 'SELECT_MEMBER', 'REGISTER'].includes(step)) return 3;
  return 4;
}

function KioskStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label={`Step ${current + 1} of ${KIOSK_STEPS.length}: ${KIOSK_STEPS[current]}`}>
      {KIOSK_STEPS.map((label, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={isCurrent ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  isCurrent ? 'bg-blue-600 text-white' : isDone ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-300'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className={`hidden md:inline text-sm font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
            </span>
            {i < KIOSK_STEPS.length - 1 && (
              <span className={`h-0.5 w-5 sm:w-8 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── State Persistence ────────────────────────────────────────────────
interface LoginPersistState {
  step: Step;
  consented: Record<ConsentKey, boolean>;
  abhaNumber: string;
  abhaProfile: AbdmProfile | null;
  abhaSourceProfile: AbdmProfile | null;
  phone: string;
  patients: Patient[];
  selectedPatient: Patient | null;
  regData: Partial<Patient>;
  department: string;
  selectedDoctor: string;
  language: string;
}

const STORAGE_KEY = 'swasthya_login_state';

function saveLoginState(state: Partial<LoginPersistState>) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...state }));
  } catch {}
}

function loadLoginState(): Partial<LoginPersistState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearLoginState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// ─────────────────────────────────────────────────────────────────────
export function Login({ onSessionStarted }: Props) {

  // Load from session storage to recover from reloads
  const saved = loadLoginState();

  // If user reloaded during OTP, they must go back a step because OTP txn is lost
  const getInitialStep = (): Step => {
    if (saved?.step === 'ABHA_OTP') return 'ABHA_IDENTIFY';
    if (saved?.step === 'MOBILE_OTP_VERIFY') return 'PHONE';
    return saved?.step || 'WELCOME_LANGUAGE';
  };

  // ── Core state ────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(getInitialStep());
  const [isLoading, setIsLoading] = useState(false);

  // ── Consent ───────────────────────────────────────────────────────
  const [consented, setConsented] = useState<Record<ConsentKey, boolean>>(saved?.consented || {
    health_data: false,
    document_extract: false,
    data_sharing: false,
  });
  const allConsented = Object.values(consented).every(Boolean);

  // ── ABHA Path A ───────────────────────────────────────────────────
  const [abhaNumber, setAbhaNumber] = useState(saved?.abhaNumber || '');
  const [abhaProfile, setAbhaProfile] = useState<AbdmProfile | null>(saved?.abhaProfile || null);
  const [txnId, setTxnId] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHasError, setOtpHasError] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // ── Mobile Path B ─────────────────────────────────────────────────
  const [phone, setPhone] = useState(saved?.phone || '');
  const [mobileTxnId, setMobileTxnId] = useState('');
  const [mobilePhoneHint, setMobilePhoneHint] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpHasError, setMobileOtpHasError] = useState(false);

  // ── Patient selection & registration ─────────────────────────────
  const [patients, setPatients] = useState<Patient[]>(saved?.patients || []);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(saved?.selectedPatient || null);
  const [abhaSourceProfile, setAbhaSourceProfile] = useState<AbdmProfile | null>(saved?.abhaSourceProfile || null);
  const [regData, setRegData] = useState<Partial<Patient>>(saved?.regData || {});

  // ── Department ────────────────────────────────────────────────────
  const [department, setDepartment] = useState(saved?.department || 'General Medicine');
  const [selectedDoctor, setSelectedDoctor] = useState(saved?.selectedDoctor || '');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const {
    language,
    setLanguage,
    setUiLang,
    speak,
    stop,
    isSpeaking,
    isMuted,
    registerAudioElement,
    registerAbortController,
  } = useAudioGuide();
  const [activeConsentAudio, setActiveConsentAudio] = useState<ConsentKey | null>(null);
  const wasSpeakingRef = useRef(false);

  // ── Welcome Language Screen Audio Loop ─────────────────────────────
  const [activeSpeakingLang, setActiveSpeakingLang] = useState<'en' | 'hi' | 'bn' | null>(null);
  const welcomeLoopAbortRef = useRef<AbortController | null>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopWelcomeLoop = useCallback(() => {
    if (welcomeLoopAbortRef.current) {
      try {
        welcomeLoopAbortRef.current.abort();
      } catch {}
      welcomeLoopAbortRef.current = null;
    }
    registerAbortController(null);

    if (welcomeAudioRef.current) {
      welcomeAudioRef.current.onended = null;
      welcomeAudioRef.current.onerror = null;
      try {
        welcomeAudioRef.current.pause();
        welcomeAudioRef.current.src = '';
      } catch {}
      welcomeAudioRef.current = null;
    }
    registerAudioElement(null);

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setActiveSpeakingLang(null);
  }, [registerAudioElement, registerAbortController]);

  const playSingleWelcome = useCallback(async (item: WelcomeLangItem) => {
    stopWelcomeLoop();
    if (isMuted) return;

    setActiveSpeakingLang(item.id);
    const abortController = new AbortController();
    welcomeLoopAbortRef.current = abortController;
    registerAbortController(abortController);

    try {
      const formData = new FormData();
      formData.append('text', item.welcomePrompt);
      formData.append('language', item.ttsLang);

      const resp = await fetch(`${getApiBaseUrl()}/api/tts`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (resp.ok) {
        const blob = await resp.blob();
        if (abortController.signal.aborted || isMuted) return;

        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        welcomeAudioRef.current = audio;
        registerAudioElement(audio);

        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
          welcomeAudioRef.current = null;
          registerAudioElement(null);
          setActiveSpeakingLang(null);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          welcomeAudioRef.current = null;
          registerAudioElement(null);
          setActiveSpeakingLang(null);
        };

        await audio.play().catch(() => {
          URL.revokeObjectURL(blobUrl);
          welcomeAudioRef.current = null;
          registerAudioElement(null);
          setActiveSpeakingLang(null);
        });
        return;
      }
    } catch {
      // Continue to fallback
    }

    if (abortController.signal.aborted || isMuted) return;

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(item.welcomePrompt);
        utt.lang = item.ttsLang;
        utt.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = item.ttsLang.slice(0, 2).toLowerCase();
        const matchingVoice = voices.find(v => {
          const vLang = v.lang.toLowerCase().replace('_', '-');
          return vLang.startsWith(langPrefix) ||
            (langPrefix === 'bn' && (v.name.toLowerCase().includes('bengali') || v.name.toLowerCase().includes('bangla')));
        });
        if (matchingVoice) utt.voice = matchingVoice;
        utt.onend = () => setActiveSpeakingLang(null);
        utt.onerror = () => setActiveSpeakingLang(null);
        window.speechSynthesis.speak(utt);
      } catch {
        setActiveSpeakingLang(null);
      }
    } else {
      setActiveSpeakingLang(null);
    }
  }, [stopWelcomeLoop, isMuted, registerAbortController, registerAudioElement]);

  const handleSelectLanguage = useCallback((langId: 'en' | 'hi' | 'bn') => {
    stopWelcomeLoop();
    stop();
    const langItem = KIOSK_LANGUAGES.find((l) => l.id === langId);
    if (langItem) {
      setLanguage(langItem.ttsLang);
      setUiLang(langItem.id);
    }
    setStep('CONSENT');
  }, [stopWelcomeLoop, stop, setLanguage, setUiLang]);

  // Audio loop for WELCOME_LANGUAGE
  useEffect(() => {
    if (step !== 'WELCOME_LANGUAGE' || isMuted) {
      stopWelcomeLoop();
      return;
    }

    const abortController = new AbortController();
    welcomeLoopAbortRef.current = abortController;
    registerAbortController(abortController);
    let isCancelled = false;

    const playPromptAsync = (item: WelcomeLangItem): Promise<boolean> => {
      return new Promise((resolve) => {
        if (abortController.signal.aborted || isCancelled || isMuted) return resolve(false);
        setActiveSpeakingLang(item.id);

        const cleanUp = () => {
          if (welcomeAudioRef.current) {
            welcomeAudioRef.current.onended = null;
            welcomeAudioRef.current.onerror = null;
            try {
              welcomeAudioRef.current.pause();
              welcomeAudioRef.current.src = '';
            } catch {}
            welcomeAudioRef.current = null;
          }
          registerAudioElement(null);
          if ('speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel();
            } catch {}
          }
        };

        abortController.signal.addEventListener('abort', () => {
          cleanUp();
          resolve(false);
        }, { once: true });

        const formData = new FormData();
        formData.append('text', item.welcomePrompt);
        formData.append('language', item.ttsLang);

        fetch(`${getApiBaseUrl()}/api/tts`, {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        })
          .then(async (resp) => {
            if (!resp.ok) throw new Error('TTS error');
            const blob = await resp.blob();
            if (abortController.signal.aborted || isCancelled || isMuted) return resolve(false);

            const blobUrl = URL.createObjectURL(blob);
            const audio = new Audio(blobUrl);
            welcomeAudioRef.current = audio;
            registerAudioElement(audio);

            audio.onended = () => {
              URL.revokeObjectURL(blobUrl);
              welcomeAudioRef.current = null;
              registerAudioElement(null);
              resolve(true);
            };
            audio.onerror = () => {
              URL.revokeObjectURL(blobUrl);
              welcomeAudioRef.current = null;
              registerAudioElement(null);
              resolve(true);
            };

            await audio.play().catch(() => {
              URL.revokeObjectURL(blobUrl);
              welcomeAudioRef.current = null;
              registerAudioElement(null);
              resolve(true);
            });
          })
          .catch(() => {
            if (abortController.signal.aborted || isCancelled || isMuted) return resolve(false);
            if ('speechSynthesis' in window) {
              try {
                window.speechSynthesis.cancel();
                const utt = new SpeechSynthesisUtterance(item.welcomePrompt);
                utt.lang = item.ttsLang;
                utt.rate = 0.95;
                const voices = window.speechSynthesis.getVoices();
                const langPrefix = item.ttsLang.slice(0, 2).toLowerCase();
                const matchingVoice = voices.find(v => {
                  const vLang = v.lang.toLowerCase().replace('_', '-');
                  return vLang.startsWith(langPrefix) ||
                    (langPrefix === 'bn' && (v.name.toLowerCase().includes('bengali') || v.name.toLowerCase().includes('bangla')));
                });
                if (matchingVoice) utt.voice = matchingVoice;
                utt.onend = () => resolve(true);
                utt.onerror = () => resolve(true);
                window.speechSynthesis.speak(utt);
              } catch {
                resolve(true);
              }
            } else {
              resolve(true);
            }
          });
      });
    };

    const runLoop = async () => {
      await new Promise((r) => setTimeout(r, 500));

      let i = 0;
      while (!abortController.signal.aborted && !isCancelled && !isMuted) {
        const item = KIOSK_LANGUAGES[i % KIOSK_LANGUAGES.length];
        const ok = await playPromptAsync(item);
        if (!ok || abortController.signal.aborted || isCancelled || isMuted) break;

        setActiveSpeakingLang(null);
        await new Promise((r) => setTimeout(r, 1200));
        i++;
      }
    };

    runLoop();

    return () => {
      isCancelled = true;
      abortController.abort();
      stopWelcomeLoop();
    };
  }, [step, isMuted, stopWelcomeLoop, registerAbortController, registerAudioElement]);

  // Immediately stop all welcome audio if muted changes to true
  useEffect(() => {
    if (isMuted) {
      stopWelcomeLoop();
      stop();
    }
  }, [isMuted, stopWelcomeLoop, stop]);

  // Auto-reset active consent audio when playback finishes
  useEffect(() => {
    if (isSpeaking) {
      wasSpeakingRef.current = true;
    } else if (wasSpeakingRef.current) {
      wasSpeakingRef.current = false;
      setActiveConsentAudio(null);
    }
  }, [isSpeaking]);

  // Safety fallback: if activeConsentAudio is set but audio is not speaking within 8 seconds, clear state
  useEffect(() => {
    if (activeConsentAudio && !isSpeaking) {
      const timer = setTimeout(() => {
        if (!wasSpeakingRef.current) {
          setActiveConsentAudio(null);
        }
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activeConsentAudio, isSpeaking]);

  // Stop active consent audio when user advances beyond consent step
  useEffect(() => {
    if (step !== 'CONSENT') {
      stop();
    }
  }, [step, stop]);


  const handleToggleConsentAudio = (key: ConsentKey, audioKey: TranslationKey) => {
    if (activeConsentAudio === key) {
      stop();
      setActiveConsentAudio(null);
      wasSpeakingRef.current = false;
    } else {
      stop();
      setActiveConsentAudio(key);
      wasSpeakingRef.current = false;
      speak(audioKey, undefined, 1, true);
    }
  };

  const { t } = useTranslation();
  const [calculatedBmi, setCalculatedBmi] = useState('');
  const [conflictInfo, setConflictInfo] = useState<{token: number; dest: string} | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  const isStartingRef = useRef(false);

  // ── Resend cooldown ───────────────────────────────────────────────
  const abhaResend = useResendCooldown(30);
  const mobileResend = useResendCooldown(30);

  // ── Persistence Effect ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      saveLoginState({
        step, consented, abhaNumber, abhaProfile, phone, patients,
        selectedPatient, abhaSourceProfile, regData, department, selectedDoctor, language
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [step, consented, abhaNumber, abhaProfile, phone, patients, selectedPatient, abhaSourceProfile, regData, department, selectedDoctor, language]);

  // ── Step Audio Announcer ──────────────────────────────────────────
  useEffect(() => {
    // Immediately terminate any leftover audio from the previous step
    stopWelcomeLoop();
    stop();

    if (step === 'WELCOME_LANGUAGE' || isMuted) return;

    const speakStep = () => {
      switch (step) {
        case 'CONSENT':
          speak('consent_intro', undefined, 1);
          break;
        case 'LANDING':
          speak('welcome', undefined, 1);
          break;
        case 'ABHA_IDENTIFY':
          speak('enter_abha', undefined, 1);
          break;
        case 'ABHA_OTP':
        case 'MOBILE_OTP_VERIFY':
          speak('enter_otp', undefined, 1);
          break;
        case 'PHONE':
          speak('enter_mobile', undefined, 1);
          break;
        case 'REGISTER':
          if (abhaSourceProfile) {
            speak('register_verify_abha', undefined, 1);
          } else {
            speak('register_manual', undefined, 1);
          }
          break;
      }
    };
    // Slight delay so DOM renders first before speaking
    const t = setTimeout(speakStep, 350);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [step, isMuted, abhaSourceProfile, speak, stop, stopWelcomeLoop]);

  // ── Load doctors + departments ────────────────────────────────────
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [directoryReload, setDirectoryReload] = useState(0);
  useEffect(() => {
    setDirectoryStatus('loading');
    fetch(`${getApiBaseUrl()}/api/doctors`)
      .then(r => r.json()).then(d => { if (d.doctors) setDoctors(d.doctors); })
      .catch(() => {});
    fetch(`${getApiBaseUrl()}/api/departments`)
      .then(r => r.json()).then(d => {
        if (d.departments?.length) {
          setDepartments(d.departments);
          setDirectoryStatus('ready');
          if (!saved?.department) {
            const def = d.departments.find((x: any) => x.is_default);
            setDepartment(def ? def.name : d.departments[0].name);
          }
        } else {
          setDirectoryStatus('error');
        }
      }).catch(() => setDirectoryStatus('error'));
  }, [directoryReload]);

  // Registration form UI state (vitals collapsed unless already filled; language picker hidden until asked)
  const [showVitals, setShowVitals] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // ── BMI auto-calc ─────────────────────────────────────────────────
  useEffect(() => {
    if (regData.weight && regData.height) {
      const h = parseFloat(regData.height) / 100;
      if (h > 0) setCalculatedBmi((regData.weight / (h * h)).toFixed(1));
    } else {
      setCalculatedBmi('');
    }
  }, [regData.weight, regData.height]);


  // ── Helpers ───────────────────────────────────────────────────────
  const formatAbhaNumber = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 14);
    const parts = [];
    if (clean.length > 0) parts.push(clean.slice(0, 2));
    if (clean.length > 2) parts.push(clean.slice(2, 6));
    if (clean.length > 6) parts.push(clean.slice(6, 10));
    if (clean.length > 10) parts.push(clean.slice(10, 14));
    return parts.join('-');
  };

  const handleGoBack = (to: Step) => {
    if (to === 'PHONE') {
      setPhone('');
      clearLoginState(); // Full reset if they go all the way back to phone/landing
    }
    setStep(to);
  };


  // ─────────────────────────────────────────────────────────────────
  // PATH A — ABHA handlers
  // ─────────────────────────────────────────────────────────────────
  const handleAbhaInit = async () => {
    const cleanNumber = abhaNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 14) {
      toast.error('Please enter a valid 14-digit ABHA number');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/abdm/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abha_number: cleanNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(typeof data.detail === 'string' ? data.detail : (data.detail?.message || 'ABHA Number not found. Try mobile login.'));
        return;
      }
      setTxnId(data.transaction_id);
      setPhoneHint(data.phone_hint);
      if (data.debug_otp) setDemoOtp(data.debug_otp);
      setOtp('');
      setOtpHasError(false);
      abhaResend.start();
      setStep('ABHA_OTP');
    } catch {
      toast.error('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbhaConfirm = async () => {
    if (otp.length < 6) return;
    setIsLoading(true);
    setOtpHasError(false);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/abdm/auth/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txnId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpHasError(true);
        toast.error(typeof data.detail === 'string' ? data.detail : (data.detail?.message || 'Incorrect OTP.'));
        return;
      }
      setAbhaProfile(data.profile);
      setAbhaSourceProfile(data.profile);
      setStep('ABHA_PROFILE_CONFIRM');
    } catch {
      toast.error('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbhaResend = async () => {
    if (abhaResend.isActive) return;
    setOtp('');
    setOtpHasError(false);
    await handleAbhaInit();
  };

  const handleAbhaProfileConfirm = () => {
    if (!abhaProfile) return;
    // Pre-fill the registration form with ABHA profile data
    const genderMap: Record<string, string> = { M: 'male', F: 'female' };
    
    // We intentionally DO NOT set selectedPatient here, so that handleStartSession
    // uses regData which contains the additionally collected fields (weight/height/vitals).
    setSelectedPatient(null);
    
    setRegData({
      full_name: abhaProfile.name,
      age: abhaProfile.age,
      gender: genderMap[abhaProfile.gender] || 'other',
      address: abhaProfile.address,
      abha_id: abhaProfile.abha_id,
    });
    setPhone(abhaProfile.mobile);
    setStep('REGISTER'); // Route through REGISTER to get weight/height/vitals
  };

  // ─────────────────────────────────────────────────────────────────
  // PATH B — Mobile OTP handlers
  // ─────────────────────────────────────────────────────────────────
  const handleMobileInit = async () => {
    if (phone.length < 10) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/abdm/auth/mobile/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(typeof data.detail === 'string' ? data.detail : (data.detail?.message || 'Failed to send OTP.'));
        return;
      }
      setMobileTxnId(data.transaction_id);
      setMobilePhoneHint(data.phone_hint);
      if (data.debug_otp) setDemoOtp(data.debug_otp);
      setMobileOtp('');
      setMobileOtpHasError(false);
      mobileResend.start();
      setStep('MOBILE_OTP_VERIFY');
    } catch {
      toast.error('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileOtpConfirm = async () => {
    if (mobileOtp.length < 6) return;
    setIsLoading(true);
    setMobileOtpHasError(false);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/abdm/auth/mobile/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: mobileTxnId, otp: mobileOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMobileOtpHasError(true);
        toast.error(typeof data.detail === 'string' ? data.detail : (data.detail?.message || 'Incorrect OTP.'));
        return;
      }
      setPatients(data.patients || []);
      if (data.patients && data.patients.length > 0) {
        setStep('SELECT_MEMBER');
      } else {
        setStep('REGISTER');
      }
    } catch {
      toast.error('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileResend = async () => {
    if (mobileResend.isActive) return;
    setMobileOtp('');
    setMobileOtpHasError(false);
    await handleMobileInit();
  };

  // ─────────────────────────────────────────────────────────────────
  // Session start
  // ─────────────────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsLoading(true);
    try {
      let finalRegData = { ...regData };
      if (calculatedBmi && !selectedPatient) {
        finalRegData.vitals = finalRegData.vitals
          ? `${finalRegData.vitals}, BMI: ${calculatedBmi}`
          : `BMI: ${calculatedBmi}`;
      }
      const payload = {
        ...(selectedPatient || finalRegData),
        phone_number: isGuestMode ? null : phone,
        department,
        doctor_id: selectedDoctor || undefined,
      };
      const res = await fetch(`${getApiBaseUrl()}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const sessionData = await res.json();
        
        if (sessionData.status === 'conflict') {
          const dest = sessionData.doctor_name ? `Dr. ${sessionData.doctor_name}` : sessionData.department;
          setConflictInfo({ token: sessionData.existing_token, dest });
          return;
        }

        clearLoginState(); // CLEANUP ON SUCCESS
        onSessionStarted(sessionData, payload as Patient, language);
      } else {
        toast.error('Failed to start session. Please try again.');
      }
    } catch {
      toast.error('Network error starting session.');
    } finally {
      setIsLoading(false);
      isStartingRef.current = false;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex-1 h-full w-full flex flex-col items-center ${['CONSENT', 'WELCOME_LANGUAGE'].includes(step) ? 'justify-start' : 'justify-center'} overflow-y-auto ${['CONSENT', 'WELCOME_LANGUAGE'].includes(step) ? '' : 'p-4 sm:p-8'}`}>
      <div className={`w-full flex flex-col items-center ${['CONSENT', 'WELCOME_LANGUAGE'].includes(step) ? 'h-full' : 'max-w-5xl'}`}>

        {/* Progress — shown on every step after Consent (Consent renders its own) */}
        {!['CONSENT', 'WELCOME_LANGUAGE'].includes(step) && (
          <div className="w-full flex justify-center mb-6">
            <KioskStepper current={kioskStepIndex(step)} />
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ────────────────────────────────────────────────────────
              STEP: WELCOME_LANGUAGE
              One decision on this screen: the language. Three large tiles,
              native script first. Below, what the visit involves, in plain words.
          ──────────────────────────────────────────────────────── */}
          {step === 'WELCOME_LANGUAGE' && (
            <motion.div
              key="WELCOME_LANGUAGE"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center px-4 sm:px-8 py-8 sm:py-12"
            >
              <div className="w-full max-w-5xl flex flex-col items-center">
                <div className="text-center">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                    Namaste. Please choose your language
                  </h1>
                  <p className="mt-3 text-lg sm:text-xl font-medium text-slate-600">
                    अपनी भाषा चुनें <span className="text-slate-300 px-1" aria-hidden="true">·</span> আপনার ভাষা বেছে নিন
                  </p>
                </div>

                {/* Audio guide: one plain status line with a single control */}
                <div className="mt-5 flex items-center gap-3 text-base text-slate-600" aria-live="polite">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isMuted ? 'bg-slate-100 text-slate-500' : activeSpeakingLang ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
                    {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className={`h-4 w-4 ${activeSpeakingLang ? 'animate-pulse' : ''}`} aria-hidden="true" />}
                  </span>
                  <span>
                    {isMuted && 'Audio guide is off. Turn it on with the speaker button at the top.'}
                    {!isMuted && activeSpeakingLang === 'en' && 'Speaking in English…'}
                    {!isMuted && activeSpeakingLang === 'hi' && 'हिन्दी में बोल रहे हैं…'}
                    {!isMuted && activeSpeakingLang === 'bn' && 'বাংলায় বলা হচ্ছে…'}
                    {!isMuted && !activeSpeakingLang && 'The kiosk reads each step aloud.'}
                  </span>
                  {!isMuted && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeSpeakingLang) stopWelcomeLoop();
                        else playSingleWelcome(KIOSK_LANGUAGES[0]);
                      }}
                      className="tap rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      {activeSpeakingLang ? 'Pause' : 'Play welcome'}
                    </button>
                  )}
                </div>

                {/* Language tiles */}
                <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                  {KIOSK_LANGUAGES.map((lang) => {
                    const isSpeakingThis = activeSpeakingLang === lang.id;
                    const mono = { en: 'bg-blue-600', hi: 'bg-emerald-600', bn: 'bg-amber-600' }[lang.id];
                    return (
                      <div key={lang.id} className="relative h-full">
                        <button
                          type="button"
                          onClick={() => handleSelectLanguage(lang.id)}
                          lang={lang.ttsLang}
                          className={`group flex h-full w-full flex-col items-start gap-4 rounded-2xl border-2 bg-white p-6 text-left shadow-card transition-[border-color,box-shadow] duration-150 hover:border-blue-600 hover:shadow-card-hover cursor-pointer min-h-[176px] ${
                            isSpeakingThis ? 'border-blue-600 shadow-card-hover' : 'border-slate-200'
                          }`}
                        >
                          <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white ${mono}`} aria-hidden="true">
                            {lang.id === 'en' ? 'En' : lang.id === 'hi' ? 'अ' : 'অ'}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-3xl font-bold text-slate-900 leading-tight">{lang.native}</span>
                            <span className="mt-1 text-base text-slate-600">
                              {lang.id === 'en' ? 'Tap to start' : lang.label}
                            </span>
                          </span>
                          <span className="mt-auto inline-flex items-center gap-1.5 text-base font-semibold text-blue-700">
                            {isSpeakingThis ? 'Speaking now · tap to choose' : 'Continue'}
                            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => playSingleWelcome(lang)}
                          aria-label={`Listen in ${lang.label}`}
                          title={`Listen in ${lang.label}`}
                          className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl border cursor-pointer ${
                            isSpeakingThis ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-blue-700 hover:border-blue-300'
                          }`}
                        >
                          <Volume2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* What happens at the kiosk */}
                <div className="mt-10 w-full border-t border-slate-200 pt-8">
                  <p className="text-center text-base font-semibold text-slate-700">What happens next</p>
                  <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { icon: <Mic className="h-5 w-5" aria-hidden="true" />, title: 'Talk', hi: 'बोलें', desc: 'Answer a few questions about how you feel, by voice or by touch.' },
                      { icon: <Scan className="h-5 w-5" aria-hidden="true" />, title: 'Scan', hi: 'स्कैन करें', desc: 'Show old prescriptions or reports to the camera, if you have them.' },
                      { icon: <Ticket className="h-5 w-5" aria-hidden="true" />, title: 'Get your token', hi: 'टोकन लें', desc: 'The doctor receives your summary before you walk in.' },
                    ].map((s, i) => (
                      <li key={s.title} className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{s.icon}</span>
                        <span>
                          <span className="block text-base font-semibold text-slate-900">
                            {i + 1}. {s.title} <span className="font-medium text-slate-500">· {s.hi}</span>
                          </span>
                          <span className="block text-sm text-slate-600">{s.desc}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <p className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />DPDP Act 2023</span>
                  <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />ABDM / ABHA linked</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: CONSENT
          ──────────────────────────────────────────────────────── */}
          {step === 'CONSENT' && (
            <motion.div
              key="CONSENT"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -24 }}
              className="w-full flex flex-col items-center px-4 sm:px-8 py-6 sm:py-10"
            >
              <div className="mb-6 sm:mb-8">
                <KioskStepper current={0} />
              </div>
              <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 lg:gap-12">
              {/* ════════════════════════════════════════════════════════
                  LEFT PANEL — Brand + Workflow Overview (~60%)
                  (On mobile, renders below the interactive consent card)
              ════════════════════════════════════════════════════════ */}
              <div className="lg:w-[55%] w-full text-slate-900 flex flex-col justify-start lg:pt-4 order-2 lg:order-1">
                <p className="text-lg text-slate-600 mb-6">{t('workflow.tagline')}</p>

                {/* ── Workflow Steps (vertical connector style) ── */}
                <div className="space-y-0">
                  <h2 className="text-xl font-bold text-slate-900 mb-5">{t('workflow.how_it_works')}</h2>

                  {[
                    {
                      icon: <Mic className="w-5 h-5" />,
                      label: t('workflow.step1_title'),
                      desc: t('workflow.step1_desc'),
                      color: 'bg-blue-600',
                    },
                    {
                      icon: <FileSearch className="w-5 h-5" />,
                      label: t('workflow.step2_title'),
                      desc: t('workflow.step2_desc'),
                      color: 'bg-emerald-600',
                    },
                    {
                      icon: <HeartPulse className="w-5 h-5" />,
                      label: t('workflow.step3_title'),
                      desc: t('workflow.step3_desc'),
                      color: 'bg-red-500',
                    },
                    {
                      icon: <Ticket className="w-5 h-5" />,
                      label: t('workflow.step4_title'),
                      desc: t('workflow.step4_desc'),
                      color: 'bg-slate-500',
                    },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex items-stretch gap-4 sm:gap-5">
                      {/* Connector line + icon */}
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${step.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                          {step.icon}
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      {/* Text */}
                      <div className={`pb-4 sm:pb-6 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                        <h3 className="text-base font-semibold text-slate-900 mb-0.5">{step.label}</h3>
                        <p className="text-base text-slate-600 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  RIGHT PANEL — Consent + Action (~38%)
                  (On mobile, renders first at top of screen)
              ════════════════════════════════════════════════════════ */}
              <div className="lg:w-[45%] w-full flex flex-col items-center order-1 lg:order-2">
                <div className="w-full max-w-lg bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-card">
                  {/* Change Language Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        stop();
                        setActiveConsentAudio(null);
                        wasSpeakingRef.current = false;
                        setStep('WELCOME_LANGUAGE');
                      }}
                      className="tap inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      <span>Change Language / भाषा बदलें</span>
                    </button>
                    <span className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                      {language === 'hi-IN' ? 'हिन्दी' : language === 'bn-IN' ? 'বাংলা' : 'English'}
                    </span>
                  </div>

                  <div className="mb-6 flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Shield className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">{t('consent.title')}</h1>
                      <p className="text-sm text-slate-500">Tick all three to continue · DPDP Act 2023</p>
                    </div>
                  </div>

                  {/* Consent checkboxes */}
                  <div className="space-y-3 mb-6">
                    {CONSENT_ITEMS.map(item => {
                      const isItemSpeaking = activeConsentAudio === item.key;
                      return (
                        <div
                          key={item.key}
                          className={`
                            tap-kiosk flex items-center justify-between gap-3 p-4 rounded-xl border-2 transition-[border-color,background-color] duration-150
                            ${consented[item.key]
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-slate-400'
                            }
                          `}
                        >
                          <label className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer select-none self-stretch py-1">
                            {/* Custom checkbox */}
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={`
                                  w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors duration-150
                                  ${consented[item.key]
                                    ? 'border-blue-600 bg-blue-600'
                                    : 'border-slate-300 bg-white'
                                  }
                                `}
                              >
                                <AnimatePresence>
                                  {consented[item.key] && (
                                    <motion.svg
                                      initial={{ scale: 0.4, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.4, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                                      className="w-4 h-4 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={3}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </motion.svg>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={consented[item.key]}
                              onChange={e => setConsented(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            />
                            <div className="min-w-0 pr-1">
                              <p className="text-base font-semibold text-slate-900 leading-snug">{t(`consent.${item.key}`)}</p>
                              <p className="text-sm text-slate-600 mt-1">{t(`consent.${item.key}_sub`)}</p>
                            </div>
                          </label>

                          {/* Interactive Audio explanation toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleConsentAudio(item.key, item.audioKey);
                            }}
                            className={`
                              h-11 w-11 rounded-xl shrink-0 flex items-center justify-center cursor-pointer border
                              ${isItemSpeaking
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:text-blue-700 hover:border-blue-300'
                              }
                            `}
                            title={isItemSpeaking ? "Click to stop explanation" : "Click to hear explanation in current language"}
                            aria-label={isItemSpeaking ? "Stop audio explanation" : "Listen to explanation"}
                          >
                            {isItemSpeaking ? (
                              <VolumeX className="w-4 h-4 text-white" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notice */}
                  <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                    <ShieldCheck className="w-4 h-4 inline mr-1 -mt-0.5 text-blue-600" aria-hidden="true" />
                    {t('consent.encrypted_notice')}
                  </p>

                  {/* Start Interview button */}
                  <motion.button
                    onClick={() => {
                      if (allConsented) {
                        stop();
                        setActiveConsentAudio(null);
                        wasSpeakingRef.current = false;
                        setStep('LANDING');
                      }
                    }}
                    disabled={!allConsented}
                    whileTap={allConsented ? { scale: 0.97 } : {}}
                    className={`
                      tap-kiosk w-full flex items-center justify-center gap-2 px-6 rounded-xl font-semibold text-lg transition-colors duration-150
                      ${allConsented
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-card cursor-pointer'
                        : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {allConsented ? (
                      <><CheckCircle2 className="w-5 h-5" /> Start Interview<ArrowRight className="w-4 h-4 ml-1" /></>
                    ) : (
                      t('consent.accept_all')
                    )}
                  </motion.button>
                </div>
              </div>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: LANDING
              Three equal ways to sign in. ABHA is marked recommended,
              not made the biggest block.
          ──────────────────────────────────────────────────────── */}
          {step === 'LANDING' && (
            <motion.div
              key="LANDING"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-5xl"
            >
              <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">How would you like to sign in?</h1>
              <p className="mx-auto mt-2 max-w-2xl text-center text-base text-slate-600">
                {t('landing.dpdp_notice')}
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    key: 'abha',
                    onClick: () => setStep('ABHA_IDENTIFY'),
                    icon: <Fingerprint className="h-6 w-6" aria-hidden="true" />,
                    iconBg: 'bg-blue-50 text-blue-700',
                    tag: <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white"><BadgeCheck className="h-4 w-4" aria-hidden="true" />Recommended</span>,
                    title: t('landing.abha_title'),
                    desc: t('landing.abha_desc'),
                    recommended: true,
                  },
                  {
                    key: 'mobile',
                    onClick: () => setStep('PHONE'),
                    icon: <Smartphone className="h-6 w-6" aria-hidden="true" />,
                    iconBg: 'bg-slate-100 text-slate-700',
                    tag: <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-600">{t('landing.walkin_no_abha')}</span>,
                    title: t('landing.walkin_title'),
                    desc: t('landing.walkin_desc'),
                    recommended: false,
                  },
                  {
                    key: 'guest',
                    onClick: () => {
                      setIsGuestMode(true);
                      setPhone('');
                      setRegData({});
                      setAbhaSourceProfile(null);
                      setSelectedPatient(null);
                      setStep('REGISTER');
                    },
                    icon: <UserCircle className="h-6 w-6" aria-hidden="true" />,
                    iconBg: 'bg-emerald-50 text-emerald-700',
                    tag: <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-700">{t('landing.guest_no_login')}</span>,
                    title: t('landing.guest_title'),
                    desc: t('landing.guest_desc'),
                    recommended: false,
                  },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={opt.onClick}
                    className={`group flex h-full min-h-[240px] flex-col items-start gap-4 rounded-2xl border-2 bg-white p-6 text-left shadow-card transition-[border-color,box-shadow] duration-150 hover:shadow-card-hover cursor-pointer ${
                      opt.recommended ? 'border-blue-600' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${opt.iconBg}`}>{opt.icon}</span>
                      {opt.tag}
                    </span>
                    <span>
                      <span className="block text-xl font-bold text-slate-900">{opt.title}</span>
                      <span className="mt-1 block text-base leading-snug text-slate-600">{opt.desc}</span>
                    </span>
                    <span className={`tap-kiosk mt-auto flex w-full items-center justify-center gap-2 rounded-xl text-lg font-semibold ${
                      opt.recommended ? 'bg-blue-600 text-white group-hover:bg-blue-700' : 'border border-slate-300 text-slate-800 group-hover:bg-slate-50'
                    }`}>
                      {t('landing.continue')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setStep('CONSENT')}
                  className="tap inline-flex items-center gap-2 rounded-xl px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  {t('landing.back_consent')}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: ABHA_IDENTIFY
          ──────────────────────────────────────────────────────── */}
          {step === 'ABHA_IDENTIFY' && (
            <motion.div
              key="ABHA_IDENTIFY"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-md"
            >
              <button onClick={() => setStep('LANDING')} className="tap inline-flex items-center gap-2 rounded-xl px-3 -ml-3 mb-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> {t('abha.back')}
              </button>

              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2.5 rounded-2xl">
                    <Fingerprint className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('abha.title')}</h1>
                    <p className="text-sm text-slate-500">Ayushman Bharat Health Account</p>
                  </div>
                </div>

                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  {t('abha.enter_address')}
                </label>
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={abhaNumber}
                    onChange={(e) => { setAbhaNumber(formatAbhaNumber(e.target.value)); }}
                    onFocus={() => stop()}
                    onKeyDown={e => e.key === 'Enter' && handleAbhaInit()}
                    placeholder={t('abha.placeholder')}
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-xl font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all tracking-wider"
                  />
                  {abhaNumber.replace(/\D/g, '').length === 14 && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" aria-hidden="true" />
                  )}
                </div>
                <NumericKeypad
                  className="mb-6"
                  disabled={isLoading}
                  onDigit={(d) => { stop(); setAbhaNumber(v => formatAbhaNumber(v.replace(/\D/g, '') + d)); }}
                  onBackspace={() => setAbhaNumber(v => formatAbhaNumber(v.replace(/\D/g, '').slice(0, -1)))}
                  onClear={() => setAbhaNumber('')}
                />

                <LiquidButton
                  onClick={handleAbhaInit}
                  disabled={isLoading || abhaNumber.replace(/\D/g, '').length !== 14}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg tap-kiosk rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('phone.send_otp')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={() => setStep('PHONE')}
                  className="w-full mt-4 text-center text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium"
                >
                  {t('abha.or_mobile')} →
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: ABHA_OTP
          ──────────────────────────────────────────────────────── */}
          {step === 'ABHA_OTP' && (
            <motion.div
              key="ABHA_OTP"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-md"
            >
              <button onClick={() => { setStep('ABHA_IDENTIFY'); setOtp(''); setOtpHasError(false); }} className="tap inline-flex items-center gap-2 rounded-xl px-3 -ml-3 mb-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> {t('abha.back')}
              </button>

              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-100 p-2.5 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('abha.verify')}</h1>
                    <p className="text-sm text-slate-500">ABHA Path — Step 2 of 3</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 mb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{t('abha.otp_sent')} <span className="font-bold text-slate-800 ml-1">{phoneHint}</span></span>
                  </div>
                  {demoOtp && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-full shadow-xs shrink-0">
                      <span>Demo OTP:</span>
                      <span className="font-mono font-bold tracking-widest text-amber-900">{demoOtp}</span>
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <OtpInput length={6} value={otp} onChange={setOtp} onFocus={() => stop()} hasError={otpHasError} />
                  <NumericKeypad
                    className="mt-5"
                    onDigit={(d) => setOtp(v => (v + d).slice(0, 6))}
                    onBackspace={() => setOtp(v => v.slice(0, -1))}
                  />
                  {otpHasError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mt-4 text-red-500 bg-red-50 px-4 py-3 rounded-lg text-sm font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Invalid OTP. Please try again.</span>
                    </motion.div>
                  )}
                </div>

                <LiquidButton
                  onClick={handleAbhaConfirm}
                  disabled={isLoading || otp.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg tap-kiosk rounded-xl transition-colors disabled:opacity-50 mb-4"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('abha.verify')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={handleAbhaResend}
                  disabled={abhaResend.isActive || isLoading}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {abhaResend.isActive ? `Resend in ${abhaResend.cooldown}s` : t('abha.resend')}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: ABHA_PROFILE_CONFIRM
          ──────────────────────────────────────────────────────── */}
          {step === 'ABHA_PROFILE_CONFIRM' && abhaProfile && (
            <motion.div
              key="ABHA_PROFILE_CONFIRM"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl shadow-card-hover border border-slate-100 border-l-4 border-l-blue-600 overflow-hidden">
                {/* Profile header */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={PFP_MAP[abhaProfile.pfp_index]}
                        alt={abhaProfile.name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 shadow-lg"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-green-400 rounded-full p-0.5">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-extrabold leading-tight">{abhaProfile.name}</h3>
                      <p className="text-blue-200 text-xs mt-0.5 mb-2">{abhaProfile.abha_id}</p>
                      <div className="inline-flex items-center gap-1.5 bg-green-400/20 border border-green-400/30 px-2.5 py-1 rounded-full">
                        <BadgeCheck className="w-3.5 h-3.5 text-green-300" />
                        <span className="text-xs font-bold text-green-200">Verified via ABDM</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile details */}
                <div className="p-6 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-2xl p-3 text-center">
                      <p className="text-xl font-extrabold text-slate-900">{abhaProfile.age}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Age (yrs)</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3 text-center">
                      <p className="text-sm font-bold text-slate-900">{abhaProfile.gender_display}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Gender</p>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-3 text-center">
                      <p className="text-sm font-bold text-red-700">{abhaProfile.blood_group || '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Blood</p>
                    </div>
                  </div>

                  {abhaProfile.address && (
                    <div className="flex items-start gap-2.5 bg-slate-50 rounded-2xl p-3">
                      <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-700 font-medium leading-snug">{abhaProfile.address}</p>
                    </div>
                  )}

                  <LiquidButton
                    onClick={handleAbhaProfileConfirm}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-600/20"
                  >
                    <CheckCircle2 className="w-5 h-5" /> {t('abha.proceed')}
                  </LiquidButton>

                  <button
                    onClick={() => { setStep('ABHA_IDENTIFY'); setAbhaProfile(null); }}
                    className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {t('abha.not_me')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: PHONE (Path B entry)
          ──────────────────────────────────────────────────────── */}
          {step === 'PHONE' && (
            <motion.div
              key="PHONE"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-md"
            >
              <button onClick={() => setStep('LANDING')} className="tap inline-flex items-center gap-2 rounded-xl px-3 -ml-3 mb-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>

              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-slate-100 p-2.5 rounded-2xl">
                    <Phone className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('phone.title')}</h1>
                    <p className="text-sm text-slate-500">{t('phone.enter_number')}</p>
                  </div>
                </div>

                <label className="text-sm font-semibold text-slate-700 mb-2 block">{t('phone.enter_number')}</label>
                <div className="flex gap-2 mb-6">
                  <div className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-3 font-bold text-slate-600 shrink-0">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onFocus={() => stop()}
                    onKeyDown={e => e.key === 'Enter' && handleMobileInit()}
                    placeholder={t('phone.placeholder')}
                    autoFocus
                    className="flex-1 min-w-0 bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-2xl font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-[border-color,box-shadow] tracking-wider"
                  />
                </div>
                <NumericKeypad
                  className="mb-6"
                  disabled={isLoading}
                  onDigit={(d) => { stop(); setPhone(v => (v + d).slice(0, 10)); }}
                  onBackspace={() => setPhone(v => v.slice(0, -1))}
                  onClear={() => setPhone('')}
                />

                <LiquidButton
                  onClick={handleMobileInit}
                  disabled={isLoading || phone.length < 10}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg tap-kiosk rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('phone.send_otp')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: MOBILE_OTP_VERIFY
          ──────────────────────────────────────────────────────── */}
          {step === 'MOBILE_OTP_VERIFY' && (
            <motion.div
              key="MOBILE_OTP_VERIFY"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-md"
            >
              <button onClick={() => { setStep('PHONE'); setMobileOtp(''); setMobileOtpHasError(false); }} className="tap inline-flex items-center gap-2 rounded-xl px-3 -ml-3 mb-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>

              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-slate-100 p-2.5 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('phone.verify_otp')}</h1>
                    <p className="text-sm text-slate-500">Mobile Path — Step 2</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 mb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{t('phone.otp_sent')} <span className="font-bold text-slate-800 ml-1">{mobilePhoneHint}</span></span>
                  </div>
                  {demoOtp && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-full shadow-xs shrink-0">
                      <span>Demo OTP:</span>
                      <span className="font-mono font-bold tracking-widest text-amber-900">{demoOtp}</span>
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <OtpInput length={6} value={mobileOtp} onChange={setMobileOtp} onFocus={() => stop()} hasError={mobileOtpHasError} />
                  <NumericKeypad
                    className="mt-5"
                    onDigit={(d) => setMobileOtp(v => (v + d).slice(0, 6))}
                    onBackspace={() => setMobileOtp(v => v.slice(0, -1))}
                  />
                  {mobileOtpHasError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mt-4 text-red-500 bg-red-50 px-4 py-3 rounded-lg text-sm font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Invalid OTP. Please try again.</span>
                    </motion.div>
                  )}
                </div>

                <LiquidButton
                  onClick={handleMobileOtpConfirm}
                  disabled={isLoading || mobileOtp.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg tap-kiosk rounded-xl transition-colors disabled:opacity-50 mb-4"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('phone.verify_otp')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={handleMobileResend}
                  disabled={mobileResend.isActive || isLoading}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {mobileResend.isActive ? `Resend in ${mobileResend.cooldown}s` : t('abha.resend')}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: SELECT_MEMBER
          ──────────────────────────────────────────────────────── */}
          {step === 'SELECT_MEMBER' && (
            <motion.div
              key="SELECT_MEMBER"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-2xl shadow-soft-1 border border-slate-100"
            >
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Users className="w-6 h-6 text-blue-500" /> {t('member.title')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {patients.map((p, idx) => {
                  // Assign deterministic PFP for known patients using their name hash
                  const nameHash = [...(p.full_name || 'X')].reduce((a, c) => a + c.charCodeAt(0), 0);
                  const pfpIdx = p.gender?.startsWith('f') ? (nameHash % 2 === 0 ? 2 : 3) : (nameHash % 2 === 0 ? 1 : 4);
                  return (
                    <LiquidButton
                      key={p.patient_id || idx}
                      onClick={() => { setSelectedPatient(p); setStep('DEPARTMENT'); }}
                      className="group flex items-center gap-3 p-4 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50/70 hover:shadow-card hover:-translate-y-0.5 active:scale-[0.97] transition-[transform,border-color,background-color,box-shadow] duration-150 text-left cursor-pointer"
                    >
                      <img
                        src={PFP_MAP[pfpIdx]}
                        alt={p.full_name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{p.full_name}</span>
                          {p.abha_id && (
                            <div className="shrink-0 bg-blue-50 text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <BadgeCheck className="w-2.5 h-2.5" /> ABDM
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">{p.age ? `${p.age} yrs, ` : ''}{p.gender}</span>
                        {p.last_visit && (
                          <div className="mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg truncate">
                            Last: {p.last_visit.chief_complaint || 'No details'}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </LiquidButton>
                  );
                })}

                <LiquidButton
                  onClick={() => setStep('REGISTER')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-blue-600 font-semibold gap-2 min-h-[80px]"
                >
                  <UserPlus className="w-6 h-6" />
                  {t('member.register_new')}
                </LiquidButton>
              </div>

              <button onClick={() => handleGoBack('PHONE')} className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: REGISTER
              Required details first; vitals are optional and folded away.
              Tap controls (gender buttons, age stepper, BP boxes) instead of typing.
          ──────────────────────────────────────────────────────── */}
          {step === 'REGISTER' && (() => {
            const locked = !!abhaSourceProfile;
            // Either side may be empty while typing ("120/ mmHg"), so both groups are optional
            const bp = (regData.vitals || '').match(/(\d{0,3})\s*\/\s*(\d{0,3})/);
            const sys = bp?.[1] || '';
            const dia = bp?.[2] || '';
            const setBp = (nextSys: string, nextDia: string) =>
              setRegData({ ...regData, vitals: nextSys || nextDia ? `${nextSys}/${nextDia} mmHg` : '' });
            const vitalsOpen = showVitals || !!(regData.weight || regData.height || regData.vitals);
            const setAge = (n: number) => setRegData({ ...regData, age: Math.max(0, Math.min(120, n)) || undefined });
            return (
            <motion.div
              key="REGISTER"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <UserPlus className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900">{t('form.title')}</h1>
                </div>
                {abhaSourceProfile && (
                  <div className="relative shrink-0">
                    <img
                      src={PFP_MAP[abhaSourceProfile.pfp_index]}
                      alt={abhaSourceProfile.name}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-blue-200"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                    </span>
                  </div>
                )}
              </div>

              {abhaSourceProfile && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 text-base">
                  <BadgeCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="text-emerald-800 font-medium">Filled in from your ABHA profile. Please check it.</span>
                </div>
              )}

              {/* About you */}
              <fieldset className="space-y-5">
                <legend className="sr-only">About you</legend>
                <Field id="reg-name" label={t('form.full_name')} required>
                  <input
                    id="reg-name"
                    type="text"
                    value={regData.full_name || ''}
                    placeholder={t('form.name_placeholder')}
                    onChange={e => setRegData({ ...regData, full_name: e.target.value })}
                    onFocus={() => stop()}
                    disabled={locked}
                    autoComplete="off"
                    className={`${inputClass} h-14 text-lg`}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field id="reg-age" label={t('form.age')} required>
                    <div className="flex items-stretch gap-2">
                      <button type="button" disabled={locked} onClick={() => setAge((regData.age || 0) - 1)} aria-label="Decrease age"
                        className="tap-kiosk w-14 shrink-0 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                        <Minus className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <input
                        id="reg-age"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={regData.age || ''}
                        placeholder={t('form.age_placeholder')}
                        onChange={e => setRegData({ ...regData, age: parseInt(e.target.value) || undefined })}
                        onFocus={() => stop()}
                        disabled={locked}
                        className={`${inputClass} h-14 text-center text-xl font-semibold tabular-nums`}
                      />
                      <button type="button" disabled={locked} onClick={() => setAge((regData.age || 0) + 1)} aria-label="Increase age"
                        className="tap-kiosk w-14 shrink-0 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                        <Plus className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </div>
                  </Field>

                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span id="reg-gender-label" className="text-sm font-semibold text-slate-700">
                      {t('form.gender')}<span className="text-red-600" aria-hidden="true"> *</span>
                    </span>
                    <div role="radiogroup" aria-labelledby="reg-gender-label" className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'male', label: t('form.male') },
                        { value: 'female', label: t('form.female') },
                        { value: 'other', label: t('form.other') },
                      ].map(g => {
                        const on = regData.gender === g.value;
                        return (
                          <button
                            key={g.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={locked}
                            onClick={() => { stop(); setRegData({ ...regData, gender: g.value }); }}
                            className={`tap-kiosk rounded-lg border-2 px-2 text-base font-semibold cursor-pointer disabled:cursor-not-allowed ${
                              on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            } ${locked && !on ? 'opacity-50' : ''}`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Field id="reg-address" label={t('form.address')}>
                  <input
                    id="reg-address"
                    type="text"
                    value={regData.address || ''}
                    placeholder={t('form.address_placeholder')}
                    onFocus={() => stop()}
                    onChange={e => setRegData({ ...regData, address: e.target.value })}
                    className={`${inputClass} h-14`}
                  />
                </Field>

                {abhaSourceProfile && (
                  <Field id="reg-abha" label="ABHA ID">
                    <input
                      id="reg-abha"
                      type="text"
                      value={regData.abha_id || ''}
                      readOnly
                      className={`${inputClass} bg-blue-50 border-blue-200 text-blue-800 font-semibold cursor-not-allowed`}
                    />
                  </Field>
                )}
              </fieldset>

              {/* Vitals — optional */}
              <div className="mt-6 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowVitals(v => !v)}
                  aria-expanded={vitalsOpen}
                  className="tap-kiosk flex w-full items-center justify-between gap-3 px-4 text-left cursor-pointer"
                >
                  <span>
                    <span className="block text-base font-semibold text-slate-900">Vitals <span className="font-normal text-slate-500">(optional)</span></span>
                    <span className="block text-sm text-slate-500">Weight, height and blood pressure, if you know them</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-150 ${vitalsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {vitalsOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-slate-200 p-4">
                    <Field id="reg-weight" label={`${t('form.weight')}`}>
                      <input
                        id="reg-weight"
                        type="number"
                        inputMode="decimal"
                        value={regData.weight || ''}
                        placeholder={t('form.weight_placeholder')}
                        onFocus={() => stop()}
                        onChange={e => setRegData({ ...regData, weight: parseFloat(e.target.value) || undefined })}
                        className={inputClass}
                      />
                    </Field>
                    <Field id="reg-height" label={`${t('form.height')}`}>
                      <input
                        id="reg-height"
                        type="text"
                        inputMode="decimal"
                        value={regData.height || ''}
                        placeholder={t('form.height_placeholder')}
                        onFocus={() => stop()}
                        onChange={e => setRegData({ ...regData, height: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                      <span id="reg-bp-label" className="text-sm font-semibold text-slate-700">{t('form.vitals')}</span>
                      <div className="flex items-center gap-2" role="group" aria-labelledby="reg-bp-label">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Systolic (top number)"
                          placeholder="120"
                          value={sys}
                          onChange={e => setBp(e.target.value.replace(/\D/g, '').slice(0, 3), dia)}
                          className={`${inputClass} text-center tabular-nums`}
                        />
                        <span className="text-2xl text-slate-400" aria-hidden="true">/</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Diastolic (bottom number)"
                          placeholder="80"
                          value={dia}
                          onChange={e => setBp(sys, e.target.value.replace(/\D/g, '').slice(0, 3))}
                          className={`${inputClass} text-center tabular-nums`}
                        />
                        <span className="text-sm text-slate-500 shrink-0">mmHg</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-slate-700">BMI</span>
                      <p className="flex h-12 items-center text-2xl font-bold tabular-nums text-slate-900" aria-live="polite">
                        {calculatedBmi || <span className="text-base font-normal text-slate-500">Worked out from weight and height</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isGuestMode) {
                      setIsGuestMode(false);
                      handleGoBack('LANDING');
                    } else {
                      handleGoBack(abhaSourceProfile ? 'ABHA_PROFILE_CONFIRM' : (patients.length ? 'SELECT_MEMBER' : 'PHONE'));
                    }
                  }}
                  className="tap-kiosk inline-flex items-center gap-2 rounded-xl px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" /> {t('phone.back')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('DEPARTMENT')}
                  disabled={!regData.full_name || !regData.age || !regData.gender}
                  className="tap-kiosk inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white shadow-card hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t('form.submit')} <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
            );
          })()}

          {/* ────────────────────────────────────────────────────────
              STEP: DEPARTMENT
              Department tiles, doctor cards, language shown as a summary
              (already chosen on the first screen) with a Change link.
          ──────────────────────────────────────────────────────── */}
          {step === 'DEPARTMENT' && (() => {
            const deptIcon = (name: string) => {
              const n = name.toLowerCase();
              if (n.includes('cardio')) return <HeartPulse className="w-6 h-6" aria-hidden="true" />;
              if (n.includes('ayush') || n.includes('ayurved')) return <Leaf className="w-6 h-6" aria-hidden="true" />;
              if (n.includes('pediat') || n.includes('paediat') || n.includes('child')) return <Baby className="w-6 h-6" aria-hidden="true" />;
              if (n.includes('ortho') || n.includes('bone')) return <Bone className="w-6 h-6" aria-hidden="true" />;
              if (n.includes('emerg') || n.includes('casualty')) return <Siren className="w-6 h-6" aria-hidden="true" />;
              if (n.includes('general') || n.includes('medicine')) return <Stethoscope className="w-6 h-6" aria-hidden="true" />;
              return <Building2 className="w-6 h-6" aria-hidden="true" />;
            };
            const deptDoctors = doctors.filter(d => d.department === department);
            const langLabel: Record<string, string> = { 'en-IN': 'English', 'hi-IN': 'हिन्दी (Hindi)', 'ta-IN': 'Tamil', 'te-IN': 'Telugu', 'kn-IN': 'Kannada', 'bn-IN': 'বাংলা (Bengali)', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi' };
            return (
            <motion.div
              key="DEPARTMENT"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-2xl shadow-card border border-slate-200"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold text-slate-900">{t('dept.title')}</h1>
                {abhaProfile && (
                  <img src={PFP_MAP[abhaProfile.pfp_index]} alt={abhaProfile.name} className="w-12 h-12 rounded-xl object-cover border-2 border-blue-100" />
                )}
              </div>

              {/* Departments */}
              <section aria-labelledby="dept-heading">
                <h2 id="dept-heading" className="text-base font-semibold text-slate-700 mb-3">{t('dept.select_dept')}</h2>
                {directoryStatus === 'error' ? (
                  <ErrorState
                    title="Couldn't load departments"
                    description="The hospital server didn't respond. Check the connection, then try again."
                    onRetry={() => setDirectoryReload(n => n + 1)}
                  />
                ) : directoryStatus === 'loading' && departments.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading departments">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                  </div>
                ) : (
                  <div role="radiogroup" aria-labelledby="dept-heading" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {departments.map(dept => {
                      const on = department === dept.name;
                      return (
                        <button
                          key={dept.dept_id || dept.name}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => { setDepartment(dept.name); setSelectedDoctor(''); }}
                          className={`flex min-h-20 items-center gap-3 rounded-xl border-2 p-3 text-left text-base font-semibold capitalize cursor-pointer transition-[border-color,background-color] duration-150 ${
                            on ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                          }`}
                        >
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {deptIcon(dept.name)}
                          </span>
                          <span className="min-w-0 leading-snug">{dept.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Doctors */}
              <section aria-labelledby="doc-heading" className="mt-8">
                <h2 id="doc-heading" className="text-base font-semibold text-slate-700 mb-3">{t('dept.select_doctor')}</h2>
                <div role="radiogroup" aria-labelledby="doc-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{ doctor_id: '', full_name: '', room_number: '', current_status: '' }, ...deptDoctors].map((doc: any) => {
                    const on = selectedDoctor === doc.doctor_id;
                    const isAny = doc.doctor_id === '';
                    return (
                      <button
                        key={doc.doctor_id || 'any'}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSelectedDoctor(doc.doctor_id)}
                        className={`tap-kiosk flex items-center gap-3 rounded-xl border-2 p-3 text-left cursor-pointer transition-[border-color,background-color] duration-150 ${
                          on ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-400'
                        }`}
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {isAny ? <Users className="w-5 h-5" aria-hidden="true" /> : <User className="w-5 h-5" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-semibold text-slate-900 truncate">{isAny ? 'Any available doctor' : (/^(dr\.?|vaidya)\s/i.test(doc.full_name || '') ? doc.full_name : `Dr. ${doc.full_name}`)}</span>
                          <span className="block text-sm text-slate-500">
                            {isAny
                              ? 'First free doctor in this department'
                              : [doc.room_number && (/^room/i.test(String(doc.room_number)) ? doc.room_number : `${t('dept.room')} ${doc.room_number}`), doc.current_status].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Interview language — chosen on the first screen */}
              <section className="mt-8 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-base text-slate-700">
                    <Globe className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    Interview language: <span className="font-semibold text-slate-900">{langLabel[language] || language}</span>
                  </p>
                  <button type="button" onClick={() => setShowLangPicker(v => !v)} aria-expanded={showLangPicker}
                    className="tap inline-flex items-center rounded-lg px-3 text-base font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">
                    {showLangPicker ? 'Done' : 'Change'}
                  </button>
                </div>
                {showLangPicker && (
                  <label className="mt-3 block">
                    <span className="sr-only">Interview language</span>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className={inputClass}>
                      {Object.entries(langLabel).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </label>
                )}
              </section>

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleGoBack(selectedPatient ? 'SELECT_MEMBER' : 'REGISTER')}
                  className="tap-kiosk inline-flex items-center gap-2 rounded-xl px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" /> {t('phone.back')}
                </button>
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={isLoading || directoryStatus !== 'ready'}
                  className="tap-kiosk inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-card hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading
                    ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Starting…</>
                    : <>{t('dept.start_session')} <ArrowRight className="w-5 h-5" aria-hidden="true" /></>}
                </button>
              </div>
            </motion.div>
            );
          })()}

        </AnimatePresence>
      </div>

      {/* ── Conflict Modal Overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {conflictInfo && (
          <motion.div
            key="conflict-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Token Already Raised</h3>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                You already have <span className="font-bold text-slate-800">Token #{conflictInfo.token}</span> for <span className="font-bold text-blue-600">{conflictInfo.dest}</span>.
                <br />Please wait in the waiting area until your turn is called.
              </p>
              <button
                onClick={() => {
                  setConflictInfo(null);
                  clearLoginState();
                  setStep('CONSENT');
                  setAbhaNumber('');
                  setAbhaProfile(null);
                  setPhone('');
                  setSelectedPatient(null);
                  setRegData({});
                  setOtp('');
                  setMobileOtp('');
                  setConsented({ health_data: false, document_extract: false, data_sharing: false });
                }}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-colors shadow-lg shadow-blue-600/20"
              >
                OK, Start New Patient
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
