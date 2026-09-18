import React, { useEffect, useRef } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 0.8, className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  // Use a spring value for smooth counting up
  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
    mass: 1,
    duration: duration * 1000,
  });

  // Start the animation when it comes into view
  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, value, spring]);

  const display = useTransform(spring, (current) => Math.round(current));

  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
};
