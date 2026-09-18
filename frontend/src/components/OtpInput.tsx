import { useRef } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import { motion } from 'framer-motion';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  length?: number;
  onFocus?: () => void;
}

export function OtpInput({ value, onChange, hasError = false, disabled = false, length = 6, onFocus }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const focusIndex = (idx: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(length - 1, idx))];
    target?.focus();
    target?.select();
  };

  const handleChange = (idx: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const newDigits = [...digits];
    newDigits[idx] = char;
    const newVal = newDigits.join('');
    onChange(newVal);
    if (char && idx < length - 1) focusIndex(idx + 1);
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const newDigits = [...digits];
        newDigits[idx] = '';
        onChange(newDigits.join(''));
      } else if (idx > 0) {
        focusIndex(idx - 1);
        const newDigits = [...digits];
        newDigits[idx - 1] = '';
        onChange(newDigits.join(''));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      focusIndex(idx - 1);
    } else if (e.key === 'ArrowRight') {
      focusIndex(idx + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted.length > 0) {
      onChange(pasted.padEnd(length, '').slice(0, length));
      focusIndex(Math.min(pasted.length, length - 1));
    }
  };

  return (
    <motion.div
      className="flex gap-2 sm:gap-3 justify-center"
      animate={hasError ? { x: [0, -8, 8, -8, 8, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={el => { inputRefs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={idx === 0}
          onChange={e => handleChange(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={e => {
            e.target.select();
            if (onFocus) onFocus();
          }}
          className={`
            w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-2xl
            border-2 outline-none transition-[transform,border-color,background-color,box-shadow] duration-150 select-none
            ${hasError
              ? 'border-red-400 bg-red-50 text-red-600'
              : digit
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10'
                : 'border-slate-200 bg-slate-50 text-slate-900 focus:scale-105 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:bg-white focus:shadow-sm'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
          `}
        />
      ))}
    </motion.div>
  );
}
