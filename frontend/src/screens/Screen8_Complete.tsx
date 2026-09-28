import { LiquidButton } from '../components/ui/button';
import { CheckCircle2, Activity, FileText, Send, UserCircle, Pill, TestTube, AlertTriangle, Sparkles, Bot, Clock, ExternalLink, Scan } from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from '../components/Toast';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { getApiBaseUrl } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAudioGuide } from '../hooks/useAudioGuide';
import { AnimatedNumber } from '../components/AnimatedNumber';

interface Props {
  language: string;
  onReset?: () => void;
  patientRecord?: any;
  sessionId?: string;
}

export function Screen8_Complete({ onReset, patientRecord, sessionId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; doctor_name: string; room_number: string } | null>(null);
  const { speak, stop } = useAudioGuide();

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (sessionId) {
      fetch(`${getApiBaseUrl()}/api/queue/token/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            setTokenInfo(data);
            speak('token_gen', { token: String(data.token), dest: data.doctor_name || 'the doctor' }, 1);
          }
        })
        .catch(console.error);
    }
  }, [sessionId, speak]);
  
  const rawName = patientRecord?.patient_name;
  const patientName = typeof rawName === 'string' ? rawName : '';
  const age = patientRecord?.patient_age;
  const gender = patientRecord?.patient_sex;
  
  const chiefComplaint = patientRecord?.chief_complaint?.value;
  const filledState = patientRecord?.filled_state || {};

  // Extract common vitals/measurements — search by substring since dynamic schema uses IDs like body_weight_kg
  const findFilledValue = (keywords: string[]) => {
    for (const [key, data] of Object.entries(filledState) as [string, any][]) {
      if (data?.value && keywords.some(kw => key.toLowerCase().includes(kw))) {
        return String(data.value);
      }
    }
    return null;
  };
  const weight = findFilledValue(['weight', 'wt']) || 'N/A';
  const height = findFilledValue(['height', 'ht']) || 'N/A';
  const vitals = findFilledValue(['blood_pressure', 'bp', 'vitals', 'pulse']) || 'N/A';

  const documents = patientRecord?.document_extractions || [];

  const vitalsKeywords = ['weight', 'wt', 'height', 'ht', 'vitals', 'blood_pressure', 'bp', 'pulse'];
  const isVitalsKey = (key: string) => vitalsKeywords.some(kw => key.toLowerCase().includes(kw));

  const hasClinicalDetails = Object.entries(filledState).some(([key, data]: [string, any]) => {
    if (!data || data.status === 'empty' || !data.value) return false;
    if (isVitalsKey(key)) return false;
    return true;
  });

  const handleSendToDoctor = async () => {
    stop();
    setIsSending(true);
    try {
      if (sessionId) {
        await fetch(`${getApiBaseUrl()}/api/session/${sessionId}/submit`, {
          method: 'POST',
        });
      }
      setIsSent(true);
    } catch (err) {
      console.error('Failed to submit to doctor:', err);
      toast.error('Failed to send to doctor. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    const tokenNumber = tokenInfo?.token || "---";
    const parsedToken = parseInt(tokenNumber, 10);
    const roomNumber = tokenInfo?.room_number || "---";
    const assignedDoctor = tokenInfo?.doctor_name ? `Dr. ${tokenInfo.doctor_name}` : "Assigned Doctor";
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-start p-3.5 sm:p-12 bg-slate-50 w-full h-full overflow-y-auto"
      >
        <div className="bg-white/95 backdrop-blur-2xl p-5 sm:p-12 rounded-3xl sm:rounded-[2.5rem] shadow-card-hover border border-slate-200/80 w-full max-w-2xl text-center relative overflow-hidden my-auto shrink-0">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />
          
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-4 sm:mb-8">
            <motion.div 
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [1, 1.4, 1.2], opacity: [0.6, 0.2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.2 }}
              className="absolute inset-0 rounded-full bg-emerald-400/40"
            />
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
              className="w-20 h-20 sm:w-28 sm:h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-card ring-4 ring-emerald-500/15 relative z-10"
            >
              <CheckCircle2 className="w-10 h-10 sm:w-14 sm:h-14" />
            </motion.div>
          </div>
          
          <h2 className="text-2xl sm:text-5xl font-extrabold text-slate-900 mb-2 sm:mb-3 tracking-tight">{t('complete.sent_to_doctor')}</h2>
          <p className="text-sm sm:text-lg text-slate-600 mb-5 sm:mb-8 font-medium leading-relaxed">{t('complete.sent_to_doctor_desc')}</p>
          
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-50/90 rounded-2xl sm:rounded-3xl p-4 sm:p-8 mb-5 sm:mb-8 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 shadow-card"
          >
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">{t('complete.token_number')}</p>
              <p className="text-4xl font-extrabold text-blue-600">
                {!isNaN(parsedToken) ? (
                  <AnimatedNumber value={parsedToken} duration={0.8} />
                ) : (
                  tokenNumber
                )}
              </p>
            </div>
            <div className="sm:border-l sm:border-slate-200/80">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('complete.room_number')}</p>
              <p className="text-4xl font-extrabold text-slate-800">{roomNumber}</p>
            </div>
            <div className="sm:border-l sm:border-slate-200/80 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('complete.doctor')}</p>
              <p className="text-2xl font-extrabold text-slate-800">{assignedDoctor}</p>
            </div>
          </motion.div>

          {/* ─── Patient Mobile Portal & AI Assistant Showcase Card ─── */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl sm:rounded-3xl p-4 sm:p-7 mb-5 sm:mb-8 border-2 border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/80 shadow-[0_12px_32px_rgba(37,99,235,0.08)] text-left relative overflow-hidden"
          >
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-300/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              {/* Big QR Code with SCAN ME badge */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="p-2.5 sm:p-3 bg-white rounded-2xl border-2 border-indigo-200 shadow-sm hover:scale-105 transition-transform duration-200">
                  <QRCode
                    value="https://swasthyasync-patient-portal.vercel.app/login"
                    size={100}
                    className="rounded-lg"
                  />
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs animate-pulse">
                  <Scan className="w-3 h-3" />
                  SCAN ME
                </span>
              </div>

              {/* Information & AI Highlight */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    AI Medical Assistant Live
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Queue Sync
                  </span>
                </div>

                <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight mb-1">
                  Scan to Open Patient Portal
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed mb-3">
                  Scan this QR code with your phone camera to see your <strong className="text-slate-900">live OPD queue status</strong> in real time and talk 1-on-1 with our <strong className="text-indigo-600">AI Medical Assistant</strong>.
                </p>

                {/* Feature Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 mb-3">
                  <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs text-xs font-bold text-slate-700">
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
                    <span>Talk to AI Medical Assistant</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-white/90 border border-indigo-100 shadow-2xs text-xs font-bold text-slate-700">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                    <span>Live Queue & Wait Times</span>
                  </div>
                </div>

                {/* Direct Link button */}
                <button
                  type="button"
                  onClick={() => window.open('https://swasthyasync-patient-portal.vercel.app/login', '_blank')}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-blue-600 hover:text-blue-800 transition-colors group cursor-pointer"
                >
                  <span>Or open Patient Portal directly in browser</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
          
          {sessionId && (
            <LiquidButton
              onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${sessionId}/pdf`, '_blank')}
              className="relative overflow-hidden w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 sm:px-8 py-3.5 sm:py-5 rounded-full font-extrabold transition-[transform,background-color,box-shadow] duration-150 text-base sm:text-xl shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] mb-3 flex items-center justify-center gap-2 sm:gap-3 cursor-pointer shadow-emerald-600/20"
            >
              <div className="absolute inset-0 shimmer-bg pointer-events-none" />
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
              <span className="relative z-10">Download OP Casesheet (PDF)</span>
            </LiquidButton>
          )}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <LiquidButton
              onClick={() => {
                stop();
                if (onReset) onReset();
                navigate('/kiosk/login');
              }}
              className="w-full bg-blue-600 text-white px-6 sm:px-8 py-3.5 sm:py-5 rounded-full font-extrabold hover:bg-blue-700 transition-[transform,background-color,box-shadow] duration-150 text-base sm:text-xl shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] mt-2 sm:mt-3 cursor-pointer shadow-blue-600/20"
            >
              {t('complete.start_new_patient')}
            </LiquidButton>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col flex-1 items-center p-3.5 sm:p-12 bg-slate-50 w-full h-full relative overflow-y-auto custom-scrollbar"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent pointer-events-none" />

      <h2 className="text-2xl sm:text-5xl font-extrabold text-slate-900 mb-2 sm:mb-4 tracking-tighter text-center">
        {t('complete.intake_complete')}, {patientName ? patientName.split(' ')[0] : 'Patient'}
      </h2>
      <p className="text-sm sm:text-xl text-slate-600 font-medium mb-6 sm:mb-10 max-w-lg text-center">
        {t('complete.review_summary_desc')}
      </p>

      {/* Structured Info Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-50 p-4 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-soft-1 border-none w-full max-w-4xl text-left mb-6 sm:mb-10"
      >
        {/* Demographics Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-8 border-b border-slate-100 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 ring-4 ring-blue-500/10">
              <UserCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{patientName || t('complete.unknown_patient')}</h3>
              <p className="text-base text-slate-600 font-semibold mt-1">{age ? `${age} yrs` : t('complete.age_na')} • {gender || t('complete.gender_na')}</p>
            </div>
          </div>
          
          <div className="flex gap-6 sm:text-right bg-slate-50 p-4 rounded-2xl shadow-soft-2 border-none">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-1">{t('complete.weight')}</p>
              <p className="text-lg font-extrabold text-slate-700">{weight}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-1">{t('complete.height')}</p>
              <p className="text-lg font-extrabold text-slate-700">{height}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-1">{t('complete.vitals')}</p>
              <p className="text-lg font-extrabold text-slate-700">{vitals}</p>
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            {t('complete.chief_complaint')}
          </h4>
          <p className="text-xl font-semibold text-red-700 bg-slate-50 p-5 rounded-2xl shadow-soft-2 border-none">
            {chiefComplaint || t('complete.not_specified')}
          </p>
        </div>

        {/* Collected Details */}
        {hasClinicalDetails && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('complete.clinical_details')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(filledState).map(([key, data]: [string, any]) => {
                if (!data || data.status === 'empty' || !data.value) return null;
                if (isVitalsKey(key)) return null;
                
                const label = data.question || key.replace(/_/g, ' ');
                
                return (
                  <div key={key} className="bg-slate-50 p-3 rounded-xl shadow-soft-2 border-none">
                    <p className="text-xs font-semibold text-slate-600 mb-1 capitalize">{label}</p>
                    <p className="text-sm font-medium text-slate-900">{String(data.value)}</p>
                    {data.verbatim && String(data.verbatim) !== String(data.value) && (
                      <p className="text-xs italic text-slate-500 mt-1 flex items-start gap-1">
                        <span className="opacity-50">"</span>{String(data.verbatim)}<span className="opacity-50">"</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Document Info */}
        {documents.length > 0 && (
          <div>
             <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
               <FileText className="w-4 h-4" />
               {t('complete.attached_documents')}
             </h4>
             
             {documents.map((doc: any, i: number) => {
               const entity = doc?.entities?.[0] || {};
               const meds = entity.medications || [];
               const labs = entity.lab_values || [];
               const diags = entity.diagnoses || [];
               const imageUrls = doc.ocr_path ? doc.ocr_path.split(',').map((p: string) => p.trim()) : [];
               
               return (
                 <div key={i} className="mb-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row">
                    {/* Document Images */}
                    {imageUrls.length > 0 ? (
                      <div className="md:w-1/3 shrink-0 flex overflow-x-auto snap-x">
                        {imageUrls.map((url: string, idx: number) => {
                          const src = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
                          return (
                            <div key={idx} className="w-full shrink-0 snap-center bg-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`Uploaded Document ${idx+1}`} className="w-full h-full object-cover min-h-[200px]" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="md:w-1/3 bg-slate-100 shrink-0 flex items-center justify-center p-6 border-r border-slate-200">
                        <p className="text-slate-500 text-sm font-medium">{t('complete.no_image')}</p>
                      </div>
                    )}
                    
                    {/* Extracted Data */}
                    <div className="p-4 md:w-2/3 space-y-4">
                      {meds.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Pill className="w-3 h-3"/> {t('complete.medications')}</h5>
                          <div className="flex flex-wrap gap-1">
                            {meds.map((m: any, j: number) => <span key={j} className="text-xs font-semibold bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100">{m?.drug_name || m}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {diags.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3"/> {t('complete.diagnoses')}</h5>
                          <div className="flex flex-wrap gap-1">
                            {diags.map((d: any, j: number) => <span key={j} className="text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">{d?.condition_name || d}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {labs.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><TestTube className="w-3 h-3"/> {t('complete.lab_results')}</h5>
                          <ul className="space-y-1">
                            {labs.map((l: any, j: number) => (
                              <li key={j} className="text-xs font-medium text-slate-700 flex justify-between bg-white px-2 py-1 border border-slate-100 rounded">
                                <span>{l?.test_name || l}</span>
                                {l?.value && <span className="font-bold">{l.value} {l.unit} {l.is_abnormal && <span className="text-red-500 ml-1">({t('complete.abnormal')})</span>}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </motion.div>

      {/* Action Button */}
      <LiquidButton
        onClick={handleSendToDoctor}
        disabled={isSending}
        className="w-full max-w-4xl bg-blue-600 text-white px-6 sm:px-8 py-3.5 sm:py-6 rounded-full font-extrabold hover:bg-blue-700 transition-[transform,background-color,box-shadow] duration-150 shadow-card-hover hover:-translate-y-0.5 text-base sm:text-xl flex items-center justify-center gap-3 sm:gap-4 disabled:bg-slate-300 disabled:shadow-none mb-6 sm:mb-10 shrink-0 active:scale-[0.97] cursor-pointer shadow-blue-600/20"
      >
        {isSending ? (
          <div className="w-5 h-5 sm:w-7 sm:h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-5 h-5 sm:w-7 sm:h-7" />
        )}
        {isSending ? t('complete.transmitting') : t('complete.send_to_doctor')}
      </LiquidButton>
    </motion.div>
  );
}
