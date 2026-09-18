/**
 * SwasthyaSync — Sarvam AI Text-to-Speech Hook
 *
 * Sends text to the backend /api/tts endpoint (powered by Sarvam AI),
 * receives WAV audio bytes, and plays them via an HTMLAudioElement.
 * Auto-selects a natural voice for the given Indian language.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '../config';

interface UseSarvamTTSReturn {
  speak: (text: string, language: string, loopCount?: number) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  error: string | null;
}

const BACKEND_URL = getApiBaseUrl();

export function useSarvamTTS(): UseSarvamTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speak = useCallback(async (text: string, language: string, loopCount: number = 1) => {
    if (!text?.trim()) return;

    stop(); // Stop any currently playing audio and abort in-flight requests
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const playFallback = () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = language || 'hi-IN';
          utterance.onstart = () => setIsSpeaking(true);
          
          let fallbackLoops = loopCount;
          utterance.onend = () => {
             if (fallbackLoops > 1) {
                fallbackLoops--;
                setTimeout(() => {
                  if (abortControllerRef.current === abortController && !abortController.signal.aborted) {
                     window.speechSynthesis.speak(utterance);
                  }
                }, 1500); // 1.5s gap
             } else {
                setIsSpeaking(false);
             }
          };
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
          return true;
        }
        return false;
    };

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language || 'hi-IN');

      const response = await fetch(`${BACKEND_URL}/api/tts`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        // Fallback to native Web Speech API if Sarvam is out of credits (402) or offline
        if (playFallback()) return;
        throw new Error(`TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      
      // If we got aborted while waiting for response, skip processing
      if (abortController.signal.aborted) return;
      
      const blobUrl = URL.createObjectURL(audioBlob);
      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      let loopsRemaining = loopCount;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        if (loopsRemaining > 1) {
          loopsRemaining--;
          setTimeout(() => {
            if (audioRef.current === audio && abortControllerRef.current === abortController && !abortController.signal.aborted) {
              audio.play().catch(console.error);
            }
          }, 1500); // 1.5s gap between loops
        } else {
          setIsSpeaking(false);
          URL.revokeObjectURL(blobUrl);
          if (blobUrlRef.current === blobUrl) {
            blobUrlRef.current = null;
          }
        }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setError('Audio playback failed');
      };

      await audio.play();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Ignored, we aborted the request on purpose
        return;
      }
      try {
        if (playFallback()) return;
      } catch (e) {
        console.error('WebSpeech fallback failed', e);
      }
      const msg = err instanceof Error ? err.message : 'TTS request failed';
      setError(msg);
      setIsSpeaking(false);
    }
  }, [stop]);

  return { speak, stop, isSpeaking, error };
}
