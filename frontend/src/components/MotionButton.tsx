import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface MotionButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
}

export const MotionButton: React.FC<MotionButtonProps> = ({ children, ...props }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <button {...props as any}>{children}</button>;
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  );
};
