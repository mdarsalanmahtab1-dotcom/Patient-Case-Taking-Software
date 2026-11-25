import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

/**
 * Counts up to `value`. Starts on mount and whenever `value` changes.
 * (Previously gated on useInView, which never fired inside nested scroll
 * containers and left numbers stuck at 0.)
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 0.8, className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  const spring = useSpring(0, { stiffness: 50, damping: 20, mass: 1, duration: duration * 1000 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const display = useTransform(spring, (current) => Math.round(current));

  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }

  return <motion.span className={`tabular-nums ${className}`}>{display}</motion.span>;
};
