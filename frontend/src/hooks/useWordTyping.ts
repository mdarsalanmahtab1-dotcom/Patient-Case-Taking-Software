/**
 * SwasthyaSync — Indic Word-by-Word Typing Effect Hook
 *
 * Streams speech-to-text transcripts word-by-word in real time:
 *  - Preserves exact Indic script (Devanagari, Tamil, Bengali, etc.) without splitting glyphs/matras
 *  - Adaptive typing speed based on sentence length (caps total time at ~1.2s)
 *  - Subtle rhythmic pauses at punctuation (। , ? !)
 *  - Blinking cursor support and completion callback
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseWordTypingOptions {
  baseWordDelayMs?: number;   // Default ms per word (default: 60ms)
  punctuationDelayMs?: number; // Additional ms pause after punctuation (default: 80ms)
  maxTotalDurationMs?: number; // Maximum total duration in ms (default: 1300ms)
  completionPauseMs?: number;  // Pause after the last word before triggering onComplete (default: 350ms)
}

export interface UseWordTypingReturn {
  isTyping: boolean;
  displayedText: string;
  activeLanguage: string;
  startTyping: (text: string, languageCode?: string, onComplete?: () => void) => void;
  cancelTyping: () => void;
  flushTyping: () => void;
}

export function useWordTyping(defaultOptions?: UseWordTypingOptions): UseWordTypingReturn {
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('hi-IN');

  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const fullTextRef = useRef<string>('');

  const baseWordDelay = defaultOptions?.baseWordDelayMs ?? 60;
  const punctDelay = defaultOptions?.punctuationDelayMs ?? 80;
  const maxDuration = defaultOptions?.maxTotalDurationMs ?? 1300;
  const completionPause = defaultOptions?.completionPauseMs ?? 350;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cancel typing and reset
  const cancelTyping = useCallback(() => {
    clearTimer();
    setIsTyping(false);
    setDisplayedText('');
    onCompleteRef.current = null;
  }, [clearTimer]);

  // Immediately display full text and trigger callback
  const flushTyping = useCallback(() => {
    clearTimer();
    setIsTyping(false);
    setDisplayedText(fullTextRef.current);
    const cb = onCompleteRef.current;
    onCompleteRef.current = null;
    cb?.();
  }, [clearTimer]);

  const startTyping = useCallback(
    (text: string, languageCode: string = 'hi-IN', onComplete?: () => void) => {
      clearTimer();
      const trimmed = text.trim();
      if (!trimmed) {
        setIsTyping(false);
        setDisplayedText('');
        onComplete?.();
        return;
      }

      fullTextRef.current = trimmed;
      setActiveLanguage(languageCode);
      onCompleteRef.current = onComplete || null;

      // Unicode-safe word boundary split:
      // In Indic scripts (Hindi, Tamil, Marathi, etc.), splitting by whitespace preserves
      // all conjuncts, matras, halants, and ligatures intact.
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        setIsTyping(false);
        setDisplayedText('');
        onComplete?.();
        return;
      }

      // Calculate adaptive word delay so long sentences don't take forever
      const naturalDuration = words.length * baseWordDelay;
      const effectiveDelay =
        naturalDuration > maxDuration
          ? Math.max(25, Math.floor(maxDuration / words.length))
          : baseWordDelay;

      setIsTyping(true);
      setDisplayedText('');

      let currentIndex = 0;

      const typeNextWord = () => {
        if (currentIndex < words.length) {
          currentIndex++;
          const currentSlice = words.slice(0, currentIndex).join(' ');
          setDisplayedText(currentSlice);

          const currentWord = words[currentIndex - 1];
          // Check for punctuation pause (Devanagari danda '।', period, comma, question, exclamation)
          const hasPunctuation = /[।.,!?]$/.test(currentWord);
          const nextDelay = effectiveDelay + (hasPunctuation ? punctDelay : 0);

          timerRef.current = window.setTimeout(typeNextWord, nextDelay);
        } else {
          // Finished all words — brief pause so user can read before triggering callback
          timerRef.current = window.setTimeout(() => {
            setIsTyping(false);
            const cb = onCompleteRef.current;
            onCompleteRef.current = null;
            cb?.();
          }, completionPause);
        }
      };

      // Start immediately
      typeNextWord();
    },
    [baseWordDelay, punctDelay, maxDuration, completionPause, clearTimer]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isTyping,
    displayedText,
    activeLanguage,
    startTyping,
    cancelTyping,
    flushTyping,
  };
}
