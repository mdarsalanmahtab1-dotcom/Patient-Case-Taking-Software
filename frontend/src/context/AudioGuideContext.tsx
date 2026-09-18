import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

const UI_LANG_STORAGE_KEY = 'swasthya_ui_lang';

interface AudioGuideContextType {
  language: string;
  setLanguage: (lang: string) => void;
  uiLang: string;
  setUiLang: (lang: string) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
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
  const [isMuted, setIsMuted] = useState(false);

  // Persist uiLang to localStorage whenever it changes
  const setUiLang = (lang: string) => {
    setUiLangState(lang);
    try {
      localStorage.setItem(UI_LANG_STORAGE_KEY, lang);
    } catch {}
  };

  return (
    <AudioGuideContext.Provider value={{ language, setLanguage, uiLang, setUiLang, isMuted, setIsMuted }}>
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
