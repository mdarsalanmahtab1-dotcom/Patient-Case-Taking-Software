import React from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  const animationClass = prefersReducedMotion ? '' : 'animate-pulse';
  
  return (
    <div className={`bg-slate-200 rounded-xl ${animationClass} ${className}`} />
  );
};
