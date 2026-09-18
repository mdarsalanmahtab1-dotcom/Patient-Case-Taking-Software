import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from './useReducedMotion';

export function useScrollToTop() {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const isKioskIntake = pathname.includes('/kiosk/') && !pathname.includes('welcome');
    
    // We defer kiosk intake scroll handling to useIntakeScrollManager
    if (!isKioskIntake) {
      // Focus main container for screen readers (Accessibility)
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.focus({ preventScroll: true });
      }

      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });

      // Also try to scroll the main container if it has its own overflow
      if (mainContent) {
        mainContent.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
    }
  }, [pathname, prefersReducedMotion]);
}
