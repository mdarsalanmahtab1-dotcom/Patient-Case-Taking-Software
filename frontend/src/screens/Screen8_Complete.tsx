import { LiquidButton } from '../components/ui/button';
import { CheckCircle2, Activity, FileText, Send, UserCircle, Pill, TestTube, AlertTriangle } from 'lucide-react';
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
            speak('token_gen', { token: String(data.token), dest: data.doctor_name || 'the doctor' });
          }
        })
        .catch(console.error);
    }
  }, [sessionId]);
  
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
        className="flex flex-col items-center justify-start p-6 sm:p-12 bg-slate-50 w-full h-full overflow-y-auto"
      >
        <div className="bg-white/95 backdrop-blur-2xl p-8 sm:p-12 rounded-[2.5rem] shadow-card-hover border border-slate-200/80 w-full max-w-2xl text-center relative overflow-hidden my-auto shrink-0">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />
          
          <div className="relative w-28 h-28 mx-auto mb-8">
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
              className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-card ring-4 ring-emerald-500/15 relative z-10"
            >
              <CheckCircle2 className="w-14 h-14" />
            </motion.div>
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('complete.sent_to_doctor')}</h2>
          <p className="text-base sm:text-lg text-slate-600 mb-8 font-medium leading-relaxed">{t('complete.sent_to_doctor_desc')}</p>
          
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-50/90 rounded-3xl p-6 sm:p-8 mb-8 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-card"
          >
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('complete.token_number')}</p>
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
          
          {sessionId && (
            <LiquidButton
              onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${sessionId}/pdf`, '_blank')}
              className="relative overflow-hidden w-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 sm:py-5 rounded-full font-extrabold transition-[transform,background-color,box-shadow] duration-150 text-lg sm:text-xl shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] mb-3 flex items-center justify-center gap-3 cursor-pointer shadow-emerald-600/20"
            >
              <div className="absolute inset-0 shimmer-bg pointer-events-none" />
              <FileText className="w-6 h-6 relative z-10" />
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
                if (onReset) onReset();
                navigate('/kiosk/login');
              }}
              className="w-full bg-blue-600 text-white px-8 py-4 sm:py-5 rounded-full font-extrabold hover:bg-blue-700 transition-[transform,background-color,box-shadow] duration-150 text-lg sm:text-xl shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] mt-3 cursor-pointer shadow-blue-600/20"
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
      className="flex flex-col flex-1 items-center p-6 sm:p-12 bg-slate-50 w-full h-full relative overflow-y-auto custom-scrollbar"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent pointer-events-none" />

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tighter">
        {t('complete.intake_complete')}, {patientName ? patientName.split(' ')[0] : 'Patient'}
      </h2>
      <p className="text-xl text-slate-600 font-medium mb-10 max-w-lg text-center">
        {t('complete.review_summary_desc')}
      </p>

      {/* Structured Info Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-50 p-8 sm:p-10 rounded-[2.5rem] shadow-soft-1 border-none w-full max-w-4xl text-left mb-10"
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
        className="w-full max-w-4xl bg-blue-600 text-white px-8 py-5 sm:py-6 rounded-full font-extrabold hover:bg-blue-700 transition-[transform,background-color,box-shadow] duration-150 shadow-card-hover hover:-translate-y-0.5 text-lg sm:text-xl flex items-center justify-center gap-4 disabled:bg-slate-300 disabled:shadow-none mb-10 shrink-0 active:scale-[0.97] cursor-pointer shadow-blue-600/20"
      >
        {isSending ? (
          <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-6 h-6 sm:w-7 sm:h-7" />
        )}
        {isSending ? t('complete.transmitting') : t('complete.send_to_doctor')}
      </LiquidButton>
    </motion.div>
  );
}
