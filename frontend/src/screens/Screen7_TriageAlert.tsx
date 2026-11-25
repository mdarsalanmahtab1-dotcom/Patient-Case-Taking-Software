import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAudioGuide } from '../hooks/useAudioGuide';

interface Props {
  onResume: () => void;
  onNewPatient: () => void;
}

/**
 * Red-flag screen. One instruction, large and still: the patient should stay put.
 * No pulsing — urgency comes from the colour and the words, not motion.
 */
export function Screen7_TriageAlert({ onResume, onNewPatient }: Props) {
  const { stopAllAudio } = useAudioGuide();
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [alertedAt] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    // Kill any and all active voices immediately on priority alert
    stopAllAudio();
  }, [stopAllAudio]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopAllAudio();
          onResume();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onResume, stopAllAudio]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="alertdialog"
      aria-labelledby="triage-title"
      aria-describedby="triage-desc"
      className="flex flex-col flex-1 items-center justify-center w-full h-full overflow-y-auto bg-red-50 px-4 py-10 sm:px-8 text-center"
    >
      <span className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-red-600 text-white">
        <ShieldAlert className="h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true" />
      </span>

      <h1 id="triage-title" className="mt-8 max-w-3xl text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-red-800 text-balance">
        Please stay here. A nurse is coming to you.
      </h1>

      <p id="triage-desc" className="mt-5 max-w-2xl text-lg sm:text-xl leading-relaxed text-red-900">
        Your answers show you may need care quickly, so you have been moved to the <strong className="font-bold">priority queue</strong>.
      </p>
      <p className="mt-2 text-base text-red-800">Nurse alerted at <span className="font-semibold tabular-nums">{alertedAt}</span></p>

      <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => { stopAllAudio(); onResume(); }}
          className="tap-kiosk flex-1 inline-flex items-center justify-center rounded-xl border-2 border-red-600 bg-white px-6 text-lg font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
        >
          I understand, continue
        </button>
        <button
          type="button"
          onClick={() => { stopAllAudio(); onNewPatient(); }}
          className="tap-kiosk flex-1 inline-flex items-center justify-center rounded-xl bg-red-600 px-6 text-lg font-semibold text-white shadow-card hover:bg-red-700 cursor-pointer"
        >
          Start new patient
        </button>
      </div>
      <p className="mt-4 text-sm text-red-800" aria-live="off">
        Returning to your questions in <span className="font-semibold tabular-nums">{secondsLeft}s</span>
      </p>
    </motion.div>
  );
}
