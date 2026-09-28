import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

const UI_LANG_STORAGE_KEY = 'swasthya_ui_lang';

interface AudioGuideContextType {
  language: string;
  setLanguage: (lang: string) => void;
  uiLang: string;
  setUiLang: (lang: string) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  stopAllAudio: () => void;
  registerAudioElement: (audio: HTMLAudioElement | null) => void;
  registerAbortController: (controller: AbortController | null) => void;
}

const AudioGuideContext = createContext<AudioGuideContextType | undefined>(undefined);

function getStoredUiLang(): string {
  try {
    return localStorage.getItem(UI_LANG_STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function AudioGuideProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<string>('en-IN');
  const [uiLang, setUiLangState] = useState<string>(getStoredUiLang);
  const [isMuted, setIsMutedState] = useState(false);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // ── Global Master Audio Terminator ──────────────────────────────
  const stopAllAudio = useCallback(() => {
    // 1. Abort in-flight network TTS fetch
    if (activeAbortControllerRef.current) {
      try {
        activeAbortControllerRef.current.abort();
      } catch {}
      activeAbortControllerRef.current = null;
    }

    // 2. Pause and clear active registered HTMLAudioElement
    if (activeAudioRef.current) {
      activeAudioRef.current.onplay = null;
      activeAudioRef.current.onended = null;
      activeAudioRef.current.onerror = null;
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      } catch {}
      activeAudioRef.current = null;
    }

    // 3. Clean up any other HTMLAudioElements in the DOM
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio').forEach((a) => {
        try {
          a.pause();
          a.src = '';
        } catch {}
      });
    }

    // 4. Cancel native browser SpeechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  const registerAudioElement = useCallback((audio: HTMLAudioElement | null) => {
    if (activeAudioRef.current && activeAudioRef.current !== audio) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      } catch {}
    }
    activeAudioRef.current = audio;
  }, []);

  const registerAbortController = useCallback((controller: AbortController | null) => {
    if (activeAbortControllerRef.current && activeAbortControllerRef.current !== controller) {
      try {
        activeAbortControllerRef.current.abort();
      } catch {}
    }
    activeAbortControllerRef.current = controller;
  }, []);

  // ── Setting isMuted instantly terminates all voices ─────────────
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    if (muted) {
      stopAllAudio();
    }
  }, [stopAllAudio]);

  // Persist uiLang to localStorage whenever it changes
  const setUiLang = useCallback((lang: string) => {
    setUiLangState(lang);
    try {
      localStorage.setItem(UI_LANG_STORAGE_KEY, lang);
    } catch {}
    // Whenever language changes, stop active speech from the previous language
    stopAllAudio();
  }, [stopAllAudio]);

  // Clean up all audio when provider unmounts
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  return (
    <AudioGuideContext.Provider
      value={{
        language,
        setLanguage,
        uiLang,
        setUiLang,
        isMuted,
        setIsMuted,
        stopAllAudio,
        registerAudioElement,
        registerAbortController,
      }}
    >
      {children}
    </AudioGuideContext.Provider>
  );
}

export function useAudioGuideContext() {
  const context = useContext(AudioGuideContext);
  if (!context) {
    throw new Error('useAudioGuideContext must be used within an AudioGuideProvider');
  }
  return context;
}
