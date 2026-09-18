import { useState, useCallback, useRef } from 'react';

/**
 * useResendCooldown — countdown timer for OTP resend buttons.
 * Starts a `seconds`-long countdown on demand.
 * While active, `isActive` is true and `cooldown` counts down to 0.
 */
export function useResendCooldown(seconds = 30) {
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCooldown(seconds);
    intervalRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds]);

  return { cooldown, start, isActive: cooldown > 0 };
}
