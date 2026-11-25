import { CheckCircle2, Activity, FileText, Send, UserCircle, Pill, TestTube, AlertTriangle, ExternalLink, DoorOpen, Stethoscope } from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from '../components/Toast';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { getApiBaseUrl } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAudioGuide } from '../hooks/useAudioGuide';

interface Props {
  language: string;
  onReset?: () => void;
  patientRecord?: any;
  sessionId?: string;
  /** Dev preview only (src/dev/KioskPreview): open directly on the token screen with sample data */
  previewSent?: boolean;
}

export function Screen8_Complete({ onReset, patientRecord, sessionId, previewSent = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(previewSent);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; doctor_name: string; room_number: string } | null>(
    previewSent ? { token: '47', doctor_name: 'Dr. Sneha Roy', room_number: '101' } : null
  );
  const { speak, stop } = useAudioGuide();
  const AUTO_RESET_SECONDS = 90;
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESET_SECONDS);

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

  const finishAndReset = () => {
    stop();
    if (onReset) onReset();
    navigate('/kiosk/login');
  };

  // After the token is shown, return the kiosk to the start so the next patient
  // never sees this patient's details. The countdown is visible on screen.
  useEffect(() => {
    if (!isSent) return;
    setSecondsLeft(AUTO_RESET_SECONDS);
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [isSent]);

  useEffect(() => {
    if (isSent && secondsLeft <= 0) finishAndReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSent, secondsLeft]);

  if (isSent) {
    const tokenNumber = tokenInfo?.token || '---';
    const parsedToken = parseInt(tokenNumber, 10);
    const roomNumber = tokenInfo?.room_number || '---';
    const rawDoctor = tokenInfo?.doctor_name || '';
    const assignedDoctor = rawDoctor
      ? (/^(dr\.?|vaidya)\s/i.test(rawDoctor) ? rawDoctor : `Dr. ${rawDoctor}`)
      : 'Assigned doctor';
    const portalUrl = 'https://swasthyasync-patient-portal.vercel.app/login';
    const mm = Math.floor(Math.max(secondsLeft, 0) / 60);
    const ss = String(Math.max(secondsLeft, 0) % 60).padStart(2, '0');

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center w-full h-full overflow-y-auto bg-slate-50 px-4 py-8 sm:px-8 sm:py-12"
      >
        <div className="w-full max-w-4xl my-auto">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('complete.sent_to_doctor')}</h1>
              <p className="text-base sm:text-lg text-slate-600">{t('complete.sent_to_doctor_desc')}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[1.6fr_1fr]">
            {/* The token is the one thing the patient must remember */}
            <section className="rounded-2xl border-2 border-blue-600 bg-white p-6 sm:p-8 shadow-card" aria-labelledby="token-label">
              <p id="token-label" className="text-lg font-semibold text-slate-600">{t('complete.token_number')}</p>
              <p className="mt-1 text-7xl sm:text-8xl font-bold leading-none tracking-tight text-blue-700 tabular-nums">
                {!isNaN(parsedToken) ? parsedToken : tokenNumber}
              </p>
              <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <DoorOpen className="h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
                  <div>
                    <dt className="text-sm text-slate-500">{t('complete.room_number')}</dt>
                    <dd className="text-2xl font-bold text-slate-900">{roomNumber}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <Stethoscope className="h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-sm text-slate-500">{t('complete.doctor')}</dt>
                    <dd className="text-xl font-bold text-slate-900 truncate">{assignedDoctor}</dd>
                  </div>
                </div>
              </dl>
            </section>

            {/* Phone follow-up */}
            <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card" aria-labelledby="portal-label">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <QRCode value={portalUrl} size={132} />
              </div>
              <p id="portal-label" className="mt-4 text-base font-semibold text-slate-900">Track your place in the queue</p>
              <p className="mt-1 text-sm text-slate-600">Scan with your phone camera to see live wait time and ask questions about your visit.</p>
              <a href={portalUrl} target="_blank" rel="noreferrer" className="tap mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:underline">
                Open patient portal <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </section>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {sessionId ? (
              <button
                type="button"
                onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${sessionId}/pdf`, '_blank')}
                className="tap-kiosk inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="h-5 w-5" aria-hidden="true" /> Download OP casesheet (PDF)
              </button>
            ) : <span />}
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                onClick={finishAndReset}
                className="tap-kiosk inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 text-lg font-semibold text-white shadow-card hover:bg-blue-700 cursor-pointer"
              >
                {t('complete.start_new_patient')}
              </button>
              <p className="text-center text-sm text-slate-500 sm:text-right" aria-live="off">
                Screen resets for the next patient in <span className="font-semibold tabular-nums text-slate-700">{mm}:{ss}</span>
              </p>
            </div>
          </div>
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
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 sm:mb-3 tracking-tight text-center">
        {t('complete.intake_complete')}, {patientName ? patientName.split(' ')[0] : 'Patient'}
      </h1>
      <p className="text-base sm:text-lg text-slate-600 mb-6 sm:mb-8 max-w-xl text-center">
        {t('complete.review_summary_desc')}
      </p>

      {/* Structured Info Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-5 sm:p-8 rounded-2xl shadow-card border border-slate-200 w-full max-w-4xl text-left mb-6"
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
          
          <div className="flex gap-6 sm:text-right bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{t('complete.weight')}</p>
              <p className="text-lg font-extrabold text-slate-700">{weight}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{t('complete.height')}</p>
              <p className="text-lg font-extrabold text-slate-700">{height}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{t('complete.vitals')}</p>
              <p className="text-lg font-extrabold text-slate-700">{vitals}</p>
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            {t('complete.chief_complaint')}
          </h2>
          <p className="text-xl font-semibold text-red-800 bg-red-50 p-5 rounded-xl border border-red-100">
            {chiefComplaint || t('complete.not_specified')}
          </p>
        </div>

        {/* Collected Details */}
        {hasClinicalDetails && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('complete.clinical_details')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(filledState).map(([key, data]: [string, any]) => {
                if (!data || data.status === 'empty' || !data.value) return null;
                if (isVitalsKey(key)) return null;
                
                const label = data.question || key.replace(/_/g, ' ');
                
                return (
                  <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-sm font-medium text-slate-600 mb-1 capitalize">{label}</p>
                    <p className="text-base font-semibold text-slate-900">{String(data.value)}</p>
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
             <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
               <FileText className="w-4 h-4" />
               {t('complete.attached_documents')}
             </h2>
             
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
                          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Pill className="w-3 h-3"/> {t('complete.medications')}</h3>
                          <div className="flex flex-wrap gap-1">
                            {meds.map((m: any, j: number) => <span key={j} className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg border border-emerald-100">{m?.drug_name || m}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {diags.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="w-3 h-3"/> {t('complete.diagnoses')}</h3>
                          <div className="flex flex-wrap gap-1">
                            {diags.map((d: any, j: number) => <span key={j} className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">{d?.condition_name || d}</span>)}
                          </div>
                        </div>
                      )}
                      
                      {labs.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><TestTube className="w-3 h-3"/> {t('complete.lab_results')}</h3>
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
      <button
        type="button"
        onClick={handleSendToDoctor}
        disabled={isSending}
        className="tap-kiosk w-full max-w-4xl bg-blue-600 text-white px-6 rounded-xl text-lg font-semibold hover:bg-blue-700 shadow-card flex items-center justify-center gap-3 disabled:bg-slate-300 mb-6 sm:mb-10 shrink-0 cursor-pointer"
      >
        {isSending ? (
          <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
        ) : (
          <Send className="w-5 h-5" aria-hidden="true" />
        )}
        {isSending ? t('complete.transmitting') : t('complete.send_to_doctor')}
      </button>
    </motion.div>
  );
}
