import { Delete } from 'lucide-react';
import { cn } from '../lib/utils';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * On-screen number pad for the kiosk (ABHA number, mobile number, OTP).
 * 56px keys so elderly patients can hit them without a physical keyboard.
 * It only emits key presses; the parent owns the value.
 */
export function NumericKeypad({ onDigit, onBackspace, onClear, disabled = false, className }: NumericKeypadProps) {
  const keyClass =
    'tap-kiosk flex items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-900 shadow-card hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

  return (
    <div className={cn('grid w-full max-w-xs mx-auto grid-cols-3 gap-2', className)} role="group" aria-label="Number keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className={keyClass} disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      {onClear ? (
        <button type="button" className={cn(keyClass, 'text-base text-slate-600')} disabled={disabled} onClick={onClear}>
          Clear
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <button type="button" className={keyClass} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className={cn(keyClass, 'text-slate-600')} disabled={disabled} onClick={onBackspace} aria-label="Delete last digit">
        <Delete className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}
