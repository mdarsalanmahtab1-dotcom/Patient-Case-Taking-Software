import { LiquidButton } from '../components/ui/button';
import { useEffect, useState } from 'react';
import { ShieldAlert, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onResume: () => void;
  onNewPatient: () => void;
}

export function Screen7_TriageAlert({ onResume, onNewPatient }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onResume();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onResume]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col flex-1 items-center justify-center p-6 sm:p-12 text-center relative overflow-hidden bg-red-50/60 w-full h-full"
    >
      {/* Controlled ambient background pulse */}
      <motion.div 
        animate={{ opacity: [0.08, 0.2, 0.08] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-300/40 via-red-100/20 to-transparent pointer-events-none" 
      />

      <div className="relative z-10 w-24 h-24 sm:w-32 sm:h-32 bg-red-100/80 rounded-full flex items-center justify-center mb-8 shadow-card">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-red-300 rounded-full"
        />
        <ShieldAlert className="w-12 h-12 sm:w-16 sm:h-16 text-red-600 relative z-10" />
      </div>

      <h2 className="relative z-10 text-3xl sm:text-5xl font-extrabold text-red-700 mb-4 sm:mb-6 tracking-tight max-w-2xl leading-tight">
        Priority Assistance Required
      </h2>
      
      <p className="relative z-10 text-base sm:text-xl text-red-900/80 font-medium mb-6 max-w-2xl bg-white/70 backdrop-blur-md p-6 rounded-3xl shadow-card border border-red-100/80 leading-relaxed">
        Based on your symptoms, we are moving you to the 
        <strong className="text-red-700 ml-1.5 font-extrabold">Priority Triage Queue</strong>. 
        A nurse has been alerted and will attend to you immediately.
      </p>

      {/* Auto-resume countdown pill */}
      <div className="relative z-10 mb-8 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-red-200/60 shadow-2xs text-xs font-bold text-red-700">
        <Clock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
        <span>Auto-resuming in <span className="font-mono text-sm">{secondsLeft}s</span></span>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4">
        <LiquidButton
          onClick={onResume}
          className="group overflow-hidden bg-white text-red-700 border border-red-200/80 px-8 sm:px-10 py-4 sm:py-5 rounded-full font-bold shadow-card hover:shadow-card-hover hover:bg-red-50/50 transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.97] text-base sm:text-lg flex items-center justify-center gap-3 cursor-pointer"
        >
          <span className="relative z-10">I Understand, Continue</span>
        </LiquidButton>
        <LiquidButton
          onClick={onNewPatient}
          className="group overflow-hidden bg-red-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-bold shadow-card-hover hover:bg-red-700 transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.97] text-base sm:text-lg flex items-center justify-center gap-3 cursor-pointer shadow-red-600/20"
        >
          <span className="relative z-10">Start New Patient</span>
        </LiquidButton>
      </div>
    </motion.div>
  );
}

