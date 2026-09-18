import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedRouteProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward';
  isKiosk?: boolean;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ children, direction = 'forward', isKiosk = false }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  // Kiosk transitions (Screen1 -> Screen8)
  if (isKiosk) {
    const xOffset = direction === 'forward' ? 16 : -16;
    return (
      <motion.div
        className="flex-1 flex flex-col w-full min-h-full"
        initial={{ opacity: 0, x: xOffset, scale: 0.99 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -xOffset * 0.75, scale: 0.99 }}
        transition={{ 
          duration: 0.28, 
          ease: [0.16, 1, 0.3, 1] 
        }}
      >
        {children}
      </motion.div>
    );
  }

  // Standard Route transitions - entrance is 250ms, exit is faster 160ms (Emil rule)
  return (
    <motion.div
      className="flex-1 flex flex-col w-full min-h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ 
        duration: 0.22, 
        ease: [0.16, 1, 0.3, 1] 
      }}
    >
      {children}
    </motion.div>
  );
};
