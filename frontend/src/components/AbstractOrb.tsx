import { motion } from 'framer-motion';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'success' | 'alert';

interface AbstractOrbProps {
  interactionState: OrbState;
  className?: string;
}

export function AbstractOrb({ interactionState, className = '' }: AbstractOrbProps) {
  // Variants for Framer Motion based on the interaction state
  const orbVariants: any = {
    idle: {
      scale: [1, 1.05, 1],
      borderRadius: ["50%", "50%", "50%"],
      background: "linear-gradient(135deg, #2563eb, #0d9488)",
      boxShadow: "0px 0px 20px rgba(37, 99, 235, 0.3)",
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    listening: {
      scale: [1, 1.1, 1],
      borderRadius: ["50%", "50%", "50%"],
      background: "linear-gradient(135deg, #3b82f6, #14b8a6)",
      boxShadow: ["0px 0px 20px rgba(59, 130, 246, 0.5)", "0px 0px 40px rgba(59, 130, 246, 0.8)", "0px 0px 20px rgba(59, 130, 246, 0.5)"],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    processing: {
      scale: 1.05,
      borderRadius: ["50%", "40% 60% 70% 30%", "60% 40% 30% 70%", "50%"],
      background: "linear-gradient(135deg, #4f46e5, #8b5cf6)",
      boxShadow: "0px 0px 30px rgba(139, 92, 246, 0.6)",
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    success: {
      scale: [1, 1.2, 1],
      y: [0, -20, 0],
      borderRadius: "50%",
      background: "linear-gradient(135deg, #10b981, #34d399)",
      boxShadow: "0px 0px 30px rgba(16, 185, 129, 0.7)",
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    },
    alert: {
      scale: [1, 1.15, 1],
      borderRadius: "50%",
      background: "linear-gradient(135deg, #ef4444, #f87171)",
      boxShadow: ["0px 0px 20px rgba(239, 68, 68, 0.6)", "0px 0px 50px rgba(239, 68, 68, 0.9)", "0px 0px 20px rgba(239, 68, 68, 0.6)"],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    speaking: {
      scale: [1, 1.08, 1, 1.06, 1],
      borderRadius: "50%",
      background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
      boxShadow: ["0px 0px 20px rgba(245, 158, 11, 0.5)", "0px 0px 35px rgba(245, 158, 11, 0.8)", "0px 0px 20px rgba(245, 158, 11, 0.5)"],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 z-0 opacity-50"
        variants={orbVariants}
        animate={interactionState}
        style={{ filter: 'blur(40px)' }}
      />
      {/* Main Orb */}
      <motion.div
        className="z-10 w-48 h-48 sm:w-64 sm:h-64 rounded-full"
        variants={orbVariants}
        animate={interactionState}
        initial="idle"
      />
    </div>
  );
}
