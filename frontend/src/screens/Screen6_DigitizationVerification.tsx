import { LiquidButton } from '../components/ui/button';
import { CheckCircle, AlertTriangle, ArrowRight, FileCheck, Stethoscope, Pill, TestTube } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../config';

interface Props {
  patientRecord: any;
  sessionId?: string;
  language?: string;
  onNext: () => void;
  onBack: () => void;
}

import { useTranslation } from '../hooks/useTranslation';

export function Screen6_DigitizationVerification({ patientRecord, sessionId, onNext, onBack }: Props) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const BACKEND_URL = getApiBaseUrl();

  // Extract data from patientRecord (use the most recent extraction)
  const extractions = patientRecord?.document_extractions || [];
  const docExt = extractions.length > 0 ? extractions[extractions.length - 1] : null;
  const firstEntity = docExt?.entities?.[0] || {};
  const entities = firstEntity;
  const summary = docExt ? `Document type: ${docExt.doc_type}` : "Clinical document processed.";
  const confidence = docExt?.requires_human_verification ? 0.65 : 0.95;

  const handleConfirm = async () => {
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
      className="flex flex-col flex-1 p-6 sm:p-10 lg:p-12 h-full max-w-5xl mx-auto w-full"
    >
      {extractions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6">
            <FileCheck className="w-16 h-16 text-slate-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4">{t('verify.no_documents_uploaded')}</h2>
          <p className="text-slate-500 text-lg mb-8 max-w-md">
            {t('verify.no_docs_desc')}
          </p>
          <LiquidButton
            onClick={onNext}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-full font-bold shadow-xl transition-all active:scale-95 text-lg"
          >
            {t('verify.continue')}
          </LiquidButton>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-emerald-100 p-3 rounded-2xl">
              <FileCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{t('verify.scan_complete')}</h2>
              <p className="text-slate-500 font-medium text-xl">{t('verify.scan_desc')}</p>
            </div>
          </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-6">
        
        {/* Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl" />
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
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
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500 rounded-l-3xl" />
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
              <p className="text-slate-400 italic">No medications detected.</p>
            )}
          </motion.div>

          {/* Diagnoses & Labs Card */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 rounded-l-3xl" />
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
                 <p className="text-slate-400 italic">No clear diagnoses detected.</p>
               )}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 rounded-l-3xl" />
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full shadow-2xs">
                                Abnormal
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
               ) : (
                 <p className="text-slate-400 italic">No lab results detected.</p>
               )}
            </motion.div>
          </div>
        </div>
             
        {Array.isArray(patientRecord?.unverifiable_values) && patientRecord.unverifiable_values.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 rounded-l-3xl" />
            <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
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
        <div className="flex items-center gap-3.5 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${confidence > 0.8 ? 'bg-emerald-500' : confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(confidence * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-600 shrink-0">
            {Math.round(confidence * 100)}% AI Confidence
          </span>
        </div>

      </div>

      <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-200 text-center font-bold text-sm">
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            {errorMsg}
          </div>
        )}
        <div className="flex gap-4">
        <LiquidButton
          onClick={onBack}
          disabled={isConfirming}
          className="px-6 sm:px-8 py-4 sm:py-5 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-[transform,background-color] duration-150 active:scale-[0.97] text-base sm:text-lg w-1/3 cursor-pointer shadow-2xs"
        >
          {t('verify.rescan')}
        </LiquidButton>
        <LiquidButton
          onClick={handleConfirm}
          disabled={isConfirming}
          className="group relative flex-1 overflow-hidden flex items-center justify-center gap-3 rounded-full py-4 sm:py-5 font-bold shadow-card-hover transition-[transform,background-color,box-shadow] duration-150 transform active:scale-[0.97] text-base sm:text-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20 cursor-pointer"
        >
           {isConfirming ? (
             <span className="relative z-10 flex items-center gap-2">
               <CheckCircle className="w-5 h-5 animate-pulse" />
               {t('verify.confirmed')}
             </span>
           ) : (
             <>
                <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none" />
                <span className="relative z-10 flex items-center gap-2">
                  {t('verify.looks_good')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
             </>
           )}
        </LiquidButton>
        </div>
      </div>
      </>
      )}
    </motion.div>
  );
}
