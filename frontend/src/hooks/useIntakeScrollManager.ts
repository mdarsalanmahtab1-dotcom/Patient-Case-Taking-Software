import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const SCREEN_ORDER = [
  'welcome',
  'demographics',
  'schema_generating',
  'conversation',
  'document_scan',
  'summary',
  'triage_alert',
  'complete'
];

export function useIntakeScrollManager(currentScreen: string | undefined) {
  const prefersReducedMotion = useReducedMotion();
  const previousScreenRef = useRef<string | undefined>(undefined);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  
  // Expose transition direction for AnimatePresence
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    if (!currentScreen) return;

    const prevIndex = previousScreenRef.current ? SCREEN_ORDER.indexOf(previousScreenRef.current) : -1;
    const currIndex = SCREEN_ORDER.indexOf(currentScreen);
    
    const isBackward = prevIndex > currIndex && prevIndex !== -1 && currIndex !== -1;
    
    setDirection(isBackward ? 'backward' : 'forward');

    const mainContent = document.querySelector('main');
    
    if (previousScreenRef.current && mainContent) {
      // Save scroll position for the screen we are leaving
      scrollPositionsRef.current[previousScreenRef.current] = mainContent.scrollTop;
    }

    // Attempt to restore scroll position or go to top
    if (mainContent) {
      if (isBackward && scrollPositionsRef.current[currentScreen] !== undefined) {
        // Moving backward, restore scroll
        mainContent.scrollTo({
          top: scrollPositionsRef.current[currentScreen],
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      } else {
        // Moving forward or unknown, scroll to top
        mainContent.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      }
      mainContent.focus({ preventScroll: true });
    }

    previousScreenRef.current = currentScreen;
  }, [currentScreen, prefersReducedMotion]);

  return { direction };
}
