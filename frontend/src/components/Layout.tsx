import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Globe, Volume2, VolumeX, ChevronDown, Check, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioGuideContext } from '../context/AudioGuideContext';
import { UI_LANGUAGES } from '../i18n/translations';
import { useTranslation } from '../hooks/useTranslation';
import logoPNG from '../assets/logo.png';

interface LayoutProps {
  children: ReactNode;
  isConnected?: boolean;
  isKioskInterview?: boolean;
  clinicMode?: string;
}

/**
 * Kiosk shell: one header bar (brand · context · language · audio · time · connection)
 * above the screen content. Previously there were two stacked headers.
 */
export function Layout({ children, isConnected = true, isKioskInterview = false, clinicMode }: LayoutProps) {
  const { uiLang, setUiLang, isMuted, setIsMuted, setLanguage } = useAudioGuideContext();
  const { t } = useTranslation();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentLangLabel = UI_LANGUAGES.find(l => l.code === uiLang)?.label || 'English';

  const handleLangSelect = (code: string) => {
    setUiLang(code);
    // Also sync TTS language
    const ttsMap: Record<string, string> = { 'en': 'en-IN', 'hi': 'hi-IN', 'bn': 'bn-IN' };
    setLanguage(ttsMap[code] || 'en-IN');
    setLangDropdownOpen(false);
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="relative z-50 shrink-0 w-full bg-white border-b border-slate-200">
        <div className="mx-auto flex h-14 sm:h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
          {/* Brand + context */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <img src={logoPNG} alt="" className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">SwasthyaSync</p>
              <p className="hidden sm:block text-xs font-medium text-slate-500 truncate">
                {isKioskInterview ? 'Clinical intake interview' : 'Patient intake kiosk'}
              </p>
            </div>
            {isKioskInterview && clinicMode === 'ayush' && (
              <span className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 truncate">
                <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">AYUSH · CCRAS protocol</span>
                <span className="md:hidden">AYUSH</span>
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={langDropdownOpen}
                aria-label={`Language: ${currentLangLabel}`}
                className="tap inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Globe className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span className="hidden sm:inline">{currentLangLabel}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>

              <AnimatePresence>
                {langDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLangDropdownOpen(false)} />
                    <motion.ul
                      role="listbox"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-elevated"
                    >
                      {UI_LANGUAGES.map((lang) => (
                        <li key={lang.code}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={uiLang === lang.code}
                            onClick={() => handleLangSelect(lang.code)}
                            className={`tap flex w-full items-center justify-between px-4 text-left text-base font-medium cursor-pointer ${
                              uiLang === lang.code ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span>{lang.label}</span>
                            {uiLang === lang.code && <Check className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-pressed={!isMuted}
              aria-label={isMuted ? t('nav.unmute') : t('nav.mute')}
              title={isMuted ? t('nav.unmute') : t('nav.mute')}
              className={`tap inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold cursor-pointer ${
                isMuted
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden md:inline">{isMuted ? 'Audio off' : 'Audio on'}</span>
            </button>

            <span className="hidden lg:inline pl-1 text-sm font-medium tabular-nums text-slate-500">{currentTime}</span>

            <span
              role="status"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
                isConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
              <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Offline'}</span>
              <span className="sr-only sm:hidden">{isConnected ? 'Connected' : 'Offline'}</span>
            </span>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 relative ${isKioskInterview ? 'overflow-hidden flex flex-col p-0 m-0' : 'overflow-y-auto overflow-x-hidden'}`}
        tabIndex={-1}
      >
        <div className={`w-full ${isKioskInterview ? 'h-full flex-1 flex flex-col overflow-hidden' : 'min-h-full flex flex-col'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
