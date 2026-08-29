/**
 * MediKiosk — Sarvam AI Text-to-Speech Hook
 *
 * Sends text to the backend /api/tts endpoint (powered by Sarvam AI),
 * receives WAV audio bytes, and plays them via an HTMLAudioElement.
 * Auto-selects a natural voice for the given Indian language.
 */

import { useState, useRef, useCallback } from 'react';

interface UseSarvamTTSReturn {
  speak: (text: string, language: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  error: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_HTTP_URL || 'http://localhost:8000';

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
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, language: string) => {
    if (!text?.trim()) return;

    stop(); // Stop any currently playing audio
    setError(null);

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language || 'hi-IN');

      const response = await fetch(`${BACKEND_URL}/api/tts`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const blobUrl = URL.createObjectURL(audioBlob);
      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(blobUrl);
        blobUrlRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setError('Audio playback failed');
      };

      await audio.play();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('TTS request aborted');
        return;
      }
      const msg = err instanceof Error ? err.message : 'TTS request failed';
      setError(msg);
      setIsSpeaking(false);
    }
  }, [stop]);

  return { speak, stop, isSpeaking, error };
}
