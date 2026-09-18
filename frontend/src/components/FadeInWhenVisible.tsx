import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface FadeInWhenVisibleProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  scale?: boolean;
}

export const FadeInWhenVisible: React.FC<FadeInWhenVisibleProps> = ({ children, delay = 0, className = '', scale = false }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: scale ? 0.98 : 1 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
