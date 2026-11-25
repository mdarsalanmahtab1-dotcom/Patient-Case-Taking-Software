import { CheckCircle, AlertTriangle, ArrowRight, FileCheck, Stethoscope, Pill, TestTube } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../config';
import { useTranslation } from '../hooks/useTranslation';
import { useAudioGuide } from '../hooks/useAudioGuide';

interface Props {
  patientRecord: any;
  sessionId?: string;
  language?: string;
  onNext: () => void;
  onBack: () => void;
}

export function Screen6_DigitizationVerification({ patientRecord, sessionId, onNext, onBack }: Props) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const BACKEND_URL = getApiBaseUrl();
  const { speak, stop } = useAudioGuide();

  useEffect(() => {
    speak('final_check', undefined, 1);
    return () => stop();
  }, [speak, stop]);

  // Extract data from patientRecord (use the most recent extraction)
  const extractions = patientRecord?.document_extractions || [];
  const docExt = extractions.length > 0 ? extractions[extractions.length - 1] : null;
  const firstEntity = docExt?.entities?.[0] || {};
  const entities = firstEntity;
  const summary = docExt ? `Document type: ${docExt.doc_type}` : "Clinical document processed.";
  const confidence = docExt?.requires_human_verification ? 0.65 : 0.95;

  const handleConfirm = async () => {
    stop();
    setIsConfirming(true);
    setErrorMsg(null);
    if (sessionId) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ocr/${sessionId}/confirm`, {
          method: 'POST',
        });
        if (!res.ok) {
          throw new Error("Failed to confirm");
        }
        setTimeout(() => {
          onNext();
        }, 600);
      } catch (err) {
        console.error("Failed to confirm OCR:", err);
        setErrorMsg("Failed to confirm digitization. Please try again.");
        setIsConfirming(false);
      }
    } else {
      setTimeout(() => {
        onNext();
      }, 600);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col flex-1 px-4 py-6 sm:px-8 sm:py-10 h-full max-w-5xl mx-auto w-full"
    >
      {extractions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6">
            <FileCheck className="w-16 h-16 text-slate-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{t('verify.no_documents_uploaded')}</h1>
          <p className="text-slate-600 text-lg mb-8 max-w-md">
            {t('verify.no_docs_desc')}
          </p>
          <button
            type="button"
            onClick={() => {
              stop();
              onNext();
            }}
            className="tap-kiosk inline-flex items-center justify-center rounded-xl bg-emerald-600 px-10 text-lg font-semibold text-white shadow-card hover:bg-emerald-700 cursor-pointer"
          >
            {t('verify.continue')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
            <div className="bg-emerald-100 p-2.5 sm:p-3 rounded-2xl shrink-0">
              <FileCheck className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{t('verify.scan_complete')}</h1>
              <p className="text-slate-600 text-base sm:text-lg">{t('verify.scan_desc')}</p>
            </div>
          </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-6">
        
        {/* Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden group"
        >
          <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-blue-500" />
            Clinical Summary
          </h3>
          <p className="text-lg text-slate-800 font-semibold leading-relaxed">
            {summary}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Medications Card */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
          >
            <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-500" />
              Medications Found
            </h3>
            {Array.isArray(entities.medications) && entities.medications.length > 0 ? (
              <ul className="space-y-2.5">
                {entities.medications.map((med: any, i: number) => {
                  const drugName = typeof med === 'string' ? med : (med?.drug_name || med?.name || 'Unknown');
                  const dosage = typeof med === 'string' ? '' : (med?.dosage || '');
                  return (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 + i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100 shadow-2xs"
                    >
                      <span className="font-bold text-slate-700">{drugName}</span>
                      {dosage && (
                        <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                          {dosage}
                        </span>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-500 italic">No medications detected.</p>
            )}
          </motion.div>

          {/* Diagnoses & Labs Card */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
            >
               <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-purple-500" />
                 Diagnoses
               </h3>
               {Array.isArray(entities.diagnoses) && entities.diagnoses.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {entities.diagnoses.map((diag: any, i: number) => {
                     const text = typeof diag === 'string' ? diag : (diag?.condition_name || (diag ? JSON.stringify(diag) : 'Unknown'));
                     return (
                       <motion.span 
                         key={i} 
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ duration: 0.18, delay: 0.15 + i * 0.03 }}
                         className="px-3.5 py-1.5 bg-purple-50 text-purple-700 font-bold text-sm rounded-xl border border-purple-200/80 shadow-2xs"
                       >
                         {text}
                       </motion.span>
                     );
                   })}
                 </div>
               ) : (
                 <p className="text-slate-500 italic">No clear diagnoses detected.</p>
               )}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
            >
               <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                 <TestTube className="w-4 h-4 text-rose-500" />
                 Lab Results
               </h3>
               {Array.isArray(entities.lab_values) && entities.lab_values.length > 0 ? (
                  <ul className="space-y-2">
                    {entities.lab_values.map((lab: any, i: number) => {
                      if (typeof lab === 'string') {
                        return (
                          <li key={i} className="flex justify-between items-center text-sm p-2.5 bg-slate-50 rounded-xl">
                            <span className="font-medium text-slate-700">{lab}</span>
                          </li>
                        );
                      }
                      return (
                        <li key={i} className="flex justify-between items-center text-sm p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                          <span className="font-medium text-slate-700">{lab?.test_name || 'Unknown test'}</span>
                          <div className="flex gap-2">
                            <span className="font-bold text-slate-900">{lab?.value || ''} {lab?.unit || ''}</span>
                            {lab?.is_abnormal && (
                              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-lg">
                                Abnormal
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
               ) : (
                 <p className="text-slate-500 italic">No lab results detected.</p>
               )}
            </motion.div>
          </div>
        </div>
             
        {Array.isArray(patientRecord?.unverifiable_values) && patientRecord.unverifiable_values.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-card relative overflow-hidden">
            <h3 className="text-base font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Unverifiable / Unrecognized Units
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              The following values contain units our system cannot verify. Please review the original document carefully.
            </p>
            <ul className="space-y-2">
              {patientRecord.unverifiable_values.map((val: any, i: number) => (
                <li key={i} className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <span className="font-medium text-amber-900">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence Indicator */}
        <div className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${confidence > 0.8 ? 'bg-emerald-500' : confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(confidence * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 shrink-0 tabular-nums">
            {Math.round(confidence * 100)}% reading confidence
          </span>
        </div>

      </div>

      <div className="mt-6 pt-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
        {errorMsg && (
          <div role="alert" className="bg-red-50 text-red-800 px-4 py-3 rounded-xl border border-red-200 text-center font-semibold text-base">
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            {errorMsg}
          </div>
        )}
        <div className="flex gap-4">
        <button
          type="button"
          onClick={() => {
            stop();
            onBack();
          }}
          disabled={isConfirming}
          className="tap-kiosk w-1/3 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          {t('verify.rescan')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming}
          className="tap-kiosk flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-lg font-semibold text-white shadow-card hover:bg-emerald-700 disabled:opacity-70 cursor-pointer"
        >
           {isConfirming ? (
             <span className="relative z-10 flex items-center gap-2">
               <CheckCircle className="w-5 h-5" />
               {t('verify.confirmed')}
             </span>
           ) : (
             <>
                <span className="relative z-10 flex items-center gap-2">
                  {t('verify.looks_good')}
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </span>
             </>
           )}
        </button>
        </div>
      </div>
      </>
      )}
    </motion.div>
  );
}
