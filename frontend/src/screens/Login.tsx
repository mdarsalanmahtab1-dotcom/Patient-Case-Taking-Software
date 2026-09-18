import { LiquidButton } from '../components/ui/button';
import { useTranslation } from '../hooks/useTranslation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Users, UserPlus, Building2, ArrowRight, User, Calendar, Activity,
  MapPin, Globe, Shield, ShieldCheck, CheckCircle2, Fingerprint, Smartphone,
  BadgeCheck, RefreshCw, ArrowLeft, ChevronRight, AlertCircle, Loader2, UserCircle,
  Mic, FileSearch, HeartPulse, Ticket, Volume2, VolumeX
} from 'lucide-react';
import { getApiBaseUrl } from '../config';
import { OtpInput } from '../components/OtpInput';
import { toast } from '../components/Toast';
import { useResendCooldown } from '../hooks/useResendCooldown';
import { useAudioGuide } from '../hooks/useAudioGuide';
import type { TranslationKey } from '../utils/audioTranslations';
import logoPNG from '../assets/logo.png';

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
    return saved?.step || 'CONSENT';
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
  const { language, setLanguage, speak, stop, isSpeaking } = useAudioGuide();
  const [activeConsentAudio, setActiveConsentAudio] = useState<ConsentKey | null>(null);
  const wasSpeakingRef = useRef(false);

  // Auto-reset active consent audio when playback finishes
  useEffect(() => {
    if (isSpeaking) {
      wasSpeakingRef.current = true;
    } else if (wasSpeakingRef.current) {
      wasSpeakingRef.current = false;
      setActiveConsentAudio(null);
    }
  }, [isSpeaking]);

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
    const speakStep = () => {
      switch (step) {
        case 'CONSENT':
          speak('consent_intro');
          break;
        case 'LANDING':
          speak('welcome');
          break;
        case 'ABHA_IDENTIFY':
          speak('enter_abha');
          break;
        case 'ABHA_OTP':
        case 'MOBILE_OTP_VERIFY':
          speak('enter_otp');
          break;
        case 'PHONE':
          speak('enter_mobile');
          break;
        case 'REGISTER':
          if (abhaSourceProfile) {
            speak('register_verify_abha');
          } else {
            speak('register_manual');
          }
          break;
      }
    };
    // Slight delay so DOM renders first before speaking
    const t = setTimeout(speakStep, 300);
    return () => clearTimeout(t);
  }, [step, abhaSourceProfile, speak]);

  // ── Load doctors + departments ────────────────────────────────────
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/doctors`)
      .then(r => r.json()).then(d => { if (d.doctors) setDoctors(d.doctors); })
      .catch(() => {});
    fetch(`${getApiBaseUrl()}/api/departments`)
      .then(r => r.json()).then(d => {
        if (d.departments?.length) {
          setDepartments(d.departments);
          if (!saved?.department) {
            const def = d.departments.find((x: any) => x.is_default);
            setDepartment(def ? def.name : d.departments[0].name);
          }
        }
      }).catch(() => {});
  }, []);

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
    <div className={`flex-1 h-full w-full flex flex-col items-center justify-center overflow-y-auto ${step === 'CONSENT' ? '' : 'p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50/30'}`}>
      <div className={`w-full flex flex-col items-center ${step === 'CONSENT' ? 'h-full' : 'max-w-3xl'}`}>

        {/* Header & Step Indicator — shown on most steps */}
        {step !== 'CONSENT' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full text-center mb-6 flex flex-col items-center"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-0.5 tracking-tight">
              SwasthyaSync
            </h2>
            <p className="text-slate-400 font-medium text-xs sm:text-sm mb-4">AI-Powered Clinical Intake System</p>

            {/* Horizontal Step Indicator Dots */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-full border border-slate-200/80 shadow-2xs">
              {[
                { label: 'Identify', idx: 0 },
                { label: 'Verify', idx: 1 },
                { label: 'Profile', idx: 2 },
                { label: 'Department', idx: 3 },
              ].map((s, i, arr) => {
                const currentIdx = ['LANDING', 'ABHA_IDENTIFY', 'PHONE'].includes(step)
                  ? 0
                  : ['ABHA_OTP', 'MOBILE_OTP_VERIFY'].includes(step)
                  ? 1
                  : ['ABHA_PROFILE_CONFIRM', 'SELECT_MEMBER', 'REGISTER'].includes(step)
                  ? 2
                  : 3;
                const isCurrent = currentIdx === s.idx;
                const isDone = currentIdx > s.idx;

                return (
                  <div key={s.idx} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-200 ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-xs scale-105'
                            : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? '✓' : s.idx + 1}
                      </div>
                      <span
                        className={`text-[11px] font-bold hidden sm:inline transition-colors duration-200 ${
                          isCurrent ? 'text-blue-700' : isDone ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className={`w-3 sm:w-4 h-0.5 rounded-full transition-colors duration-200 ${
                          isDone ? 'bg-emerald-400' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">

          {/* ────────────────────────────────────────────────────────
              STEP: CONSENT
          ──────────────────────────────────────────────────────── */}
          {step === 'CONSENT' && (
            <motion.div
              key="CONSENT"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -24 }}
              className="w-full h-full flex flex-col lg:flex-row"
              style={{ minHeight: 'calc(100vh - 120px)' }}
            >
              {/* ════════════════════════════════════════════════════════
                  LEFT PANEL — Brand + Workflow Overview (~60%)
              ════════════════════════════════════════════════════════ */}
              <div className="lg:w-[62%] w-full bg-transparent text-slate-900 p-8 sm:p-12 lg:p-16 flex flex-col justify-center relative overflow-hidden">
                {/* Decorative orbs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />

                {/* Hospital branding */}
                <div className="relative z-10 mb-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                      <img src={logoPNG} alt="SwasthyaSync" className="w-9 h-9 object-contain" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('workflow.gov_kiosk')}</p>
                      <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight text-slate-900">SwasthyaSync</h2>
                    </div>
                  </div>
                  <p className="text-slate-600 text-lg font-medium">{t('workflow.tagline')}</p>
                </div>

                {/* ── Workflow Steps (vertical connector style) ── */}
                <div className="relative z-10 space-y-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{t('workflow.how_it_works')}</p>

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
                    <div key={i} className="flex items-stretch gap-5">
                      {/* Connector line + icon */}
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-xl ${step.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                          {step.icon}
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      {/* Text */}
                      <div className={`pb-6 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                        <h4 className="text-sm font-bold text-slate-900 mb-0.5">{step.label}</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  RIGHT PANEL — Consent + Action (~38%)
              ════════════════════════════════════════════════════════ */}
              <div className="lg:w-[38%] w-full bg-transparent p-8 sm:p-10 lg:p-12 flex flex-col justify-center items-center">
                <div className="max-w-md w-full bg-white/70 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-xl shadow-slate-200/50">
                  {/* Small heading */}
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 mb-4">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-1">{t('consent.title')}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      DPDP Act 2023 · National Digital Health Mission
                    </p>
                  </div>

                  {/* Consent checkboxes */}
                  <div className="space-y-3 mb-6">
                    {CONSENT_ITEMS.map(item => {
                      const isItemSpeaking = activeConsentAudio === item.key;
                      return (
                        <div
                          key={item.key}
                          className={`
                            flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all duration-200
                            ${consented[item.key]
                              ? 'border-blue-400 bg-blue-50/70 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                            }
                          `}
                        >
                          <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer select-none">
                            {/* Custom checkbox */}
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={`
                                  w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
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
                                      className="w-3 h-3 text-white"
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
                              <p className="text-xs font-semibold text-slate-800 leading-snug">{t(`consent.${item.key}`)}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{t(`consent.${item.key}_sub`)}</p>
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
                              p-2 rounded-xl shrink-0 transition-all duration-200 flex items-center justify-center relative
                              ${isItemSpeaking
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 ring-2 ring-blue-400 ring-offset-1 animate-pulse'
                                : 'bg-slate-100/90 text-slate-500 hover:bg-blue-100 hover:text-blue-600 hover:scale-105 active:scale-95'
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
                  <p className="text-[10px] text-slate-400 text-center mb-6 leading-relaxed">
                    <ShieldCheck className="w-3 h-3 inline mr-1 text-blue-400" />
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
                      w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all duration-300
                      ${allConsented
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: LANDING
          ──────────────────────────────────────────────────────── */}
          {step === 'LANDING' && (
            <motion.div
              key="LANDING"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl"
            >
              {/* Back to Consent */}
              <button
                onClick={() => setStep('CONSENT')}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mb-6 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('landing.back_consent')}
              </button>

              <p className="text-center text-xs text-slate-400 mb-6 leading-relaxed">
                {t('landing.dpdp_notice')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card A — ABHA */}
                <motion.button
                  whileHover={{ y: -2, scale: 1.005 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('ABHA_IDENTIFY')}
                  className="flex flex-col items-start p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-600/25 text-left transition-[transform,box-shadow] cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-bold tracking-wide">{t('landing.abha_tag')}</div>
                    <div className="bg-green-400/30 backdrop-blur px-2 py-0.5 rounded-full text-xs font-semibold text-green-200 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> {t('landing.abha_verified')}
                    </div>
                  </div>
                  <Fingerprint className="w-10 h-10 mb-3 text-white/80" />
                  <h3 className="text-xl font-extrabold mb-1">{t('landing.abha_title')}</h3>
                  <p className="text-blue-100 text-sm leading-snug mb-4">
                    {t('landing.abha_desc')}
                  </p>
                  <div className="flex items-center gap-1 text-white/70 text-sm font-semibold mt-auto">
                    {t('landing.continue')} <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>

                {/* Card B — Mobile */}
                <motion.button
                  whileHover={{ y: -2, scale: 1.005 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('PHONE')}
                  className="flex flex-col items-start p-6 rounded-3xl bg-white border-2 border-slate-100 text-left shadow-lg hover:border-slate-200 hover:shadow-card-hover transition-[transform,box-shadow,border-color] cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold tracking-wide text-slate-600">{t('landing.walkin_tag')}</div>
                    <div className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium text-slate-500">
                      {t('landing.walkin_no_abha')}
                    </div>
                  </div>
                  <Smartphone className="w-10 h-10 mb-3 text-slate-500" />
                  <h3 className="text-xl font-extrabold text-slate-900 mb-1">{t('landing.walkin_title')}</h3>
                  <p className="text-slate-500 text-sm leading-snug mb-4">
                    {t('landing.walkin_desc')}
                  </p>
                  <div className="flex items-center gap-1 text-blue-600 text-sm font-semibold mt-auto">
                    {t('landing.continue')} <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>
              </div>

              {/* Card C — Guest (no phone, no ABHA) */}
              <motion.button
                whileHover={{ y: -2, scale: 1.005 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setIsGuestMode(true);
                  setPhone('');
                  setRegData({});
                  setAbhaSourceProfile(null);
                  setSelectedPatient(null);
                  setStep('REGISTER');
                }}
                className="mt-4 w-full flex flex-col items-start p-6 rounded-3xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-xl shadow-emerald-600/25 text-left transition-[transform,box-shadow] cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-bold tracking-wide">{t('landing.guest_tag')}</div>
                  <div className="bg-emerald-400/30 backdrop-blur px-2 py-0.5 rounded-full text-xs font-semibold text-emerald-200 flex items-center gap-1">
                    {t('landing.guest_no_login')}
                  </div>
                </div>
                <UserCircle className="w-10 h-10 mb-3 text-white/80" />
                <h3 className="text-xl font-extrabold mb-1">{t('landing.guest_title')}</h3>
                <p className="text-emerald-100 text-sm leading-snug mb-4">
                  {t('landing.guest_desc')}
                </p>
                <div className="flex items-center gap-1 text-white/70 text-sm font-semibold mt-auto">
                  {t('landing.continue')} <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>
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
              <button onClick={() => setStep('LANDING')} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> {t('abha.back')}
              </button>

              <div className="bg-white p-6 rounded-3xl shadow-soft-1 border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2.5 rounded-2xl">
                    <Fingerprint className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{t('abha.title')}</h3>
                    <p className="text-xs text-slate-400">Ayushman Bharat Health Account</p>
                  </div>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {t('abha.enter_address')}
                </label>
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={abhaNumber}
                    onChange={(e) => { setAbhaNumber(formatAbhaNumber(e.target.value)); }}
                    onFocus={() => speak('enter_abha')}
                    onKeyDown={e => e.key === 'Enter' && handleAbhaInit()}
                    placeholder={t('abha.placeholder')}
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-lg font-semibold text-slate-900 placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all tracking-wider"
                  />
                  {abhaNumber.replace(/\D/g, '').length === 14 && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>

                <LiquidButton
                  onClick={handleAbhaInit}
                  disabled={isLoading || abhaNumber.replace(/\D/g, '').length !== 14}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('phone.send_otp')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={() => setStep('PHONE')}
                  className="w-full mt-4 text-center text-sm text-slate-400 hover:text-blue-600 transition-colors font-medium"
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
              <button onClick={() => { setStep('ABHA_IDENTIFY'); setOtp(''); setOtpHasError(false); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> {t('abha.back')}
              </button>

              <div className="bg-white p-6 rounded-3xl shadow-soft-1 border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-100 p-2.5 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{t('abha.verify')}</h3>
                    <p className="text-xs text-slate-400">ABHA Path — Step 2 of 3</p>
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
                  <OtpInput length={6} value={otp} onChange={setOtp} onFocus={() => speak('enter_otp')} hasError={otpHasError} />
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
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 mb-4"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('abha.verify')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={handleAbhaResend}
                  disabled={abhaResend.isActive || isLoading}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60 font-medium"
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
              <div className="bg-white rounded-3xl shadow-card-hover border border-slate-100 border-l-4 border-l-blue-600 overflow-hidden">
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
                      <p className="text-xs text-slate-400 mt-0.5">Age (yrs)</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3 text-center">
                      <p className="text-sm font-bold text-slate-900">{abhaProfile.gender_display}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Gender</p>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-3 text-center">
                      <p className="text-sm font-bold text-red-700">{abhaProfile.blood_group || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Blood</p>
                    </div>
                  </div>

                  {abhaProfile.address && (
                    <div className="flex items-start gap-2.5 bg-slate-50 rounded-2xl p-3">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
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
                    className="w-full text-center text-sm text-slate-400 hover:text-slate-700 transition-colors"
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
              <button onClick={() => setStep('LANDING')} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>

              <div className="bg-white p-6 rounded-3xl shadow-soft-1 border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-slate-100 p-2.5 rounded-2xl">
                    <Phone className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{t('phone.title')}</h3>
                    <p className="text-xs text-slate-400">{t('phone.enter_number')}</p>
                  </div>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t('phone.enter_number')}</label>
                <div className="flex gap-2 mb-6">
                  <div className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-3 font-bold text-slate-600 shrink-0">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onFocus={() => speak('enter_mobile')}
                    onKeyDown={e => e.key === 'Enter' && handleMobileInit()}
                    placeholder={t('phone.placeholder')}
                    autoFocus
                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-2xl font-semibold text-slate-900 placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all tracking-wider"
                  />
                </div>

                <LiquidButton
                  onClick={handleMobileInit}
                  disabled={isLoading || phone.length < 10}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
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
              <button onClick={() => { setStep('PHONE'); setMobileOtp(''); setMobileOtpHasError(false); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>

              <div className="bg-white p-6 rounded-3xl shadow-soft-1 border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-slate-100 p-2.5 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{t('phone.verify_otp')}</h3>
                    <p className="text-xs text-slate-400">Mobile Path — Step 2</p>
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
                  <OtpInput length={6} value={mobileOtp} onChange={setMobileOtp} onFocus={() => speak('enter_otp')} hasError={mobileOtpHasError} />
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
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 mb-4"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>{t('phone.verify_otp')} <ArrowRight className="w-4 h-4" /></>}
                </LiquidButton>

                <button
                  onClick={handleMobileResend}
                  disabled={mobileResend.isActive || isLoading}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60 font-medium"
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
              className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-soft-1 border border-slate-100"
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
                            <div className="shrink-0 bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
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
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
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

              <button onClick={() => handleGoBack('PHONE')} className="text-slate-400 hover:text-slate-700 font-medium text-sm flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
              </button>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: REGISTER
          ──────────────────────────────────────────────────────── */}
          {step === 'REGISTER' && (
            <motion.div
              key="REGISTER"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-soft-1 border border-slate-100"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-blue-500" /> {t('form.title')}
                </h3>
                {/* Profile picture if came from ABHA */}
                {abhaSourceProfile && (
                  <div className="relative shrink-0">
                    <img
                      src={PFP_MAP[abhaSourceProfile.pfp_index]}
                      alt={abhaSourceProfile.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-200 shadow"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-green-400 rounded-full p-0.5">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-fill banner */}
              {abhaSourceProfile && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 text-sm">
                  <BadgeCheck className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-green-800 font-medium">Pre-filled from your ABHA profile. Please verify and correct if needed.</span>
                </div>
              )}

              <div className="space-y-4 mb-8">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <User className="w-3 h-3" /> {t('form.full_name')} *
                  </label>
                  <input
                    type="text"
                    value={regData.full_name || ''}
                    placeholder={t('form.name_placeholder')}
                    onChange={e => setRegData({...regData, full_name: e.target.value})}
                    onFocus={() => speak('enter_name')}
                    disabled={!!abhaSourceProfile}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Age */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3" /> {t('form.age')} *
                    </label>
                    <input
                      type="number"
                      value={regData.age || ''}
                      placeholder={t('form.age_placeholder')}
                      onChange={e => setRegData({...regData, age: parseInt(e.target.value) || undefined})}
                      onFocus={() => speak('enter_age')}
                      disabled={!!abhaSourceProfile}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  {/* Gender */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <User className="w-3 h-3" /> {t('form.gender')} *
                    </label>
                    <select
                      value={regData.gender || ''}
                      onChange={e => setRegData({...regData, gender: e.target.value})}
                      onFocus={() => speak('select_gender')}
                      disabled={!!abhaSourceProfile}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="male">{t('form.male')}</option>
                      <option value="female">{t('form.female')}</option>
                      <option value="other">{t('form.other')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Weight */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3" /> {t('form.weight')}
                    </label>
                    <input
                      type="number"
                      value={regData.weight || ''}
                      placeholder={t('form.weight_placeholder')}
                      onFocus={() => speak('enter_weight')}
                      onChange={e => setRegData({ ...regData, weight: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  {/* Height */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3" /> {t('form.height')}
                    </label>
                    <input
                      type="text"
                      value={regData.height || ''}
                      placeholder={t('form.height_placeholder')}
                      onFocus={() => speak('enter_height')}
                      onChange={e => setRegData({ ...regData, height: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* BMI auto */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3" /> BMI (Auto)
                    </label>
                    <input
                      type="text"
                      value={calculatedBmi}
                      disabled
                      placeholder="Calculated automatically"
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-500 outline-none"
                    />
                  </div>
                  {/* Vitals */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3" /> {t('form.vitals')}
                    </label>
                    <input
                      type="text"
                      value={regData.vitals || ''}
                      onChange={e => setRegData({ ...regData, vitals: e.target.value })}
                      placeholder="e.g. 120/80 mmHg"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <MapPin className="w-3 h-3" /> {t('form.address')}
                  </label>
                  <input
                    type="text"
                    value={regData.address || ''}
                    placeholder={t('form.address_placeholder')}
                    onFocus={() => speak('enter_address')}
                    onChange={e => setRegData({ ...regData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                {/* ABHA ID (pre-filled and read-only if from ABHA path) */}
                {abhaSourceProfile && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-1">
                      <Fingerprint className="w-3 h-3" /> ABHA ID
                    </label>
                    <input
                      type="text"
                      value={regData.abha_id || ''}
                      readOnly
                      className="w-full bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 font-semibold outline-none cursor-not-allowed"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    if (isGuestMode) {
                      setIsGuestMode(false);
                      handleGoBack('LANDING');
                    } else {
                      handleGoBack(abhaSourceProfile ? 'ABHA_PROFILE_CONFIRM' : (patients.length ? 'SELECT_MEMBER' : 'PHONE'));
                    }
                  }}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-700 font-medium text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
                </button>
                <LiquidButton
                  onClick={() => setStep('DEPARTMENT')}
                  disabled={!regData.full_name || !regData.age || !regData.gender}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  {t('form.submit')} <ArrowRight className="w-4 h-4" />
                </LiquidButton>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────
              STEP: DEPARTMENT
          ──────────────────────────────────────────────────────── */}
          {step === 'DEPARTMENT' && (
            <motion.div
              key="DEPARTMENT"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-soft-1 border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-blue-500" /> {t('dept.title')}
                </h3>
                {/* Show profile pic if ABHA path */}
                {abhaProfile && (
                  <img
                    src={PFP_MAP[abhaProfile.pfp_index]}
                    alt={abhaProfile.name}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-blue-100"
                  />
                )}
              </div>

              <div className="mb-6">
                <label className="text-sm font-bold text-slate-700 uppercase mb-3 block">{t('dept.select_dept')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {departments.map(dept => (
                    <LiquidButton
                      key={dept.dept_id || dept.name}
                      onClick={() => { setDepartment(dept.name); setSelectedDoctor(''); }}
                      className={`py-3 px-4 rounded-xl border-2 font-semibold transition-[transform,border-color,background-color,box-shadow] duration-150 capitalize text-sm hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer ${
                        department === dept.name
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 text-slate-600 hover:shadow-2xs'
                      }`}
                    >
                      {dept.name}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-500" /> {t('dept.select_doctor')}
                </label>
                <select
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg font-medium focus:border-blue-500 outline-none"
                >
                  <option value="">Any Available Doctor</option>
                  {doctors.filter(d => d.department === department).map(doc => (
                    <option key={doc.doctor_id} value={doc.doctor_id}>
                      Dr. {doc.full_name} ({t('dept.room')} {doc.room_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-8">
                <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-blue-500" /> Preferred Language
                </label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg font-medium focus:border-blue-500 outline-none"
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="ta-IN">Tamil</option>
                  <option value="te-IN">Telugu</option>
                  <option value="kn-IN">Kannada</option>
                  <option value="bn-IN">Bengali</option>
                  <option value="mr-IN">Marathi</option>
                  <option value="gu-IN">Gujarati</option>
                  <option value="ml-IN">Malayalam</option>
                  <option value="pa-IN">Punjabi</option>
                </select>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleGoBack(selectedPatient ? 'SELECT_MEMBER' : 'REGISTER')}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-700 font-medium text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> {t('phone.back')}
                </button>
                <LiquidButton
                  onClick={handleStartSession}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-green-600/20"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    : <>{t('dept.start_session')} <ArrowRight className="w-5 h-5" /></>
                  }
                </LiquidButton>
              </div>
            </motion.div>
          )}

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
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
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
