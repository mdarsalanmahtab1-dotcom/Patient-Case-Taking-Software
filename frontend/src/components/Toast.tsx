import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

// Simple event emitter for toasts
type Listener = (toast: ToastMessage) => void;
let listeners: Listener[] = [];

export const toast = {
  success: (message: string) => addToast('success', message),
  error: (message: string) => addToast('error', message),
  info: (message: string) => addToast('info', message),
};

function addToast(type: ToastType, message: string) {
  const newToast = { id: Math.random().toString(36).substring(2, 9), type, message };
  listeners.forEach(l => l(newToast));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      const duration = toast.type === 'error' ? 6000 : 4000;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, duration);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} reducedMotion={prefersReducedMotion} onDismiss={() => setToasts(prev => prev.filter(item => item.id !== t.id))} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage, reducedMotion: boolean, onDismiss: () => void }> = ({ toast, reducedMotion, onDismiss }) => {
  const borderColor = toast.type === 'success' ? 'border-l-teal-600' : toast.type === 'error' ? 'border-l-red-600' : 'border-l-blue-600';
  const progressColor = toast.type === 'success' ? 'bg-teal-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  const duration = toast.type === 'error' ? 6 : 4;

  const motionProps = reducedMotion ? {} : {
    initial: { x: 80, opacity: 0, scale: 0.96 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: { x: 80, opacity: 0, scale: 0.96 },
    transition: { type: 'spring' as const, stiffness: 350, damping: 28 },
    drag: "x" as const,
    dragConstraints: { left: 0, right: 120 },
    onDragEnd: (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x > 60) onDismiss();
    }
  };

  return (
    <motion.div
      {...motionProps}
      layout
      className={`pointer-events-auto bg-white/95 backdrop-blur-md shadow-card-hover rounded-lg border border-slate-200/80 border-l-4 ${borderColor} p-3.5 w-76 relative overflow-hidden cursor-grab active:cursor-grabbing select-none`}
      onClick={onDismiss}
    >
      <p className="text-xs sm:text-sm font-semibold text-slate-800 pr-2 leading-snug">{toast.message}</p>
      
      {/* Progress bar */}
      <motion.div 
        className={`absolute bottom-0 left-0 h-0.5 ${progressColor}`}
        initial={reducedMotion ? { width: 0 } : { width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration, ease: 'linear' }}
      />
    </motion.div>
  );
};
