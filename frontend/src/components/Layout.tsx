import type { ReactNode } from 'react';
import { useRef, useState, useEffect } from 'react';
import { Wifi, WifiOff, Globe, Volume2, VolumeX } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAudioGuideContext } from '../context/AudioGuideContext';
import { UI_LANGUAGES } from '../i18n/translations';
import { useTranslation } from '../hooks/useTranslation';
import logoPNG from '../assets/logo.png';

interface LayoutProps {
  children: ReactNode;
  isConnected?: boolean;
  isKioskInterview?: boolean;
}

export function Layout({ children, isConnected = true, isKioskInterview = false }: LayoutProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
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
  
  const { scrollY } = useScroll({ container: scrollRef });
  
  // Spring physics for smooth scroll interpolation
  const smoothScrollY = useSpring(scrollY, { stiffness: 300, damping: 30, restDelta: 0.001 });

  const headerPaddingY = useTransform(smoothScrollY, [0, 50], ["0.75rem", "0.5rem"]);
  const headerShadow = useTransform(smoothScrollY, [0, 50], ["0 8px 30px rgba(0,0,0,0.08)", "0 12px 40px rgba(0,0,0,0.15)"]);
  const headerBlur = useTransform(smoothScrollY, [0, 50], ["blur(12px)", "blur(24px)"]);

  const motionHeaderStyle = prefersReducedMotion ? {} : {
    paddingTop: headerPaddingY,
    paddingBottom: headerPaddingY,
    boxShadow: headerShadow,
    backdropFilter: headerBlur,
    WebkitBackdropFilter: headerBlur
  };

  const currentLangLabel = UI_LANGUAGES.find(l => l.code === uiLang)?.label || 'English';

  const handleLangSelect = (code: string) => {
    setUiLang(code);
    // Also sync TTS language
    const ttsMap: Record<string, string> = { 'en': 'en-IN', 'hi': 'hi-IN', 'bn': 'bn-IN' };
    setLanguage(ttsMap[code] || 'en-IN');
    setLangDropdownOpen(false);
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-white flex flex-col overflow-hidden">
      {/* Top status bar — hospital-grade with subtle gradient border */}
      <div className="w-full px-3 sm:px-6 py-1.5 flex items-center justify-between bg-gradient-to-r from-white via-slate-50/60 to-white border-b border-slate-200/80 text-xs shadow-2xs z-50 relative shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-700 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-slate-900 font-extrabold tracking-tight">SwasthyaSync v2.0</span>
          </div>
          {isKioskInterview && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              Clinical Intake
            </span>
          )}
        </div>

        {/* Right side controls: Language, Mute, Time, Connection status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isKioskInterview && (
            <>
              {/* Compact Language Selector in Top Bar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200 rounded-full transition-[transform,background-color,border-color] duration-150 active:scale-95 cursor-pointer shadow-2xs"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>{currentLangLabel}</span>
                  <span className="text-[9px] text-slate-400">▾</span>
                </button>

                <AnimatePresence>
                  {langDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setLangDropdownOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-card-hover border border-slate-200/80 overflow-hidden z-50 origin-top-right backdrop-blur-md"
                      >
                        {UI_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => handleLangSelect(lang.code)}
                            className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                              uiLang === lang.code 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{lang.label}</span>
                            {uiLang === lang.code && (
                              <span className="text-blue-600 font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Compact Audio Toggle in Top Bar */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`inline-flex items-center justify-center p-1 px-2.5 gap-1.5 rounded-full text-xs font-bold border transition-[transform,background-color,border-color] duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                  isMuted 
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
                title={isMuted ? t('nav.unmute') : t('nav.mute')}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-600" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
                <span className="hidden md:inline">{isMuted ? 'Muted' : 'Audio'}</span>
              </button>
            </>
          )}

          <span className="text-slate-500 font-medium text-xs">{currentTime}</span>
          <div className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs transition-all duration-300 ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {isConnected ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            )}
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50">
        {/* Floating Header: ONLY rendered on non-interview screens */}
        {!isKioskInterview && (
          <div className="absolute top-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
            <motion.header 
              style={motionHeaderStyle}
              className="pointer-events-auto w-full max-w-3xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between bg-white border border-slate-100 rounded-full shadow-lg z-10"
            >
              <div className="flex items-center">
                <motion.div
                  className="w-8 h-8 mr-3 sm:mr-4 hidden sm:block"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  whileHover={{ rotate: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="16" fill="url(#paint0_linear)" />
                    <defs>
                      <linearGradient id="paint0_linear" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FF9966" />
                        <stop offset="1" stopColor="#FF5E62" />
                      </linearGradient>
                    </defs>
                  </svg>
                </motion.div>
                <div className="flex items-center justify-center rounded-full overflow-hidden bg-white mr-2 sm:mr-3">
                  <img src={logoPNG} alt="SwasthyaSync Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
                  <p className="text-xs text-blue-600 font-bold tracking-wide uppercase">AI-Powered Patient Intake</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Kiosk Mode indicator */}
                <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  {t('nav.kiosk_mode')}
                </div>

                {/* Language Picker */}
                <div className="relative">
                  <motion.button
                    whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {currentLangLabel}
                  </motion.button>

                  <AnimatePresence>
                    {langDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div 
                          className="fixed inset-0 z-30" 
                          onClick={() => setLangDropdownOpen(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40"
                        >
                          {UI_LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => handleLangSelect(lang.code)}
                              className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                                uiLang === lang.code 
                                  ? 'bg-blue-50 text-blue-700' 
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {lang.label}
                              {uiLang === lang.code && (
                                <span className="ml-2 text-blue-500">✓</span>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mute / Unmute */}
                <motion.button 
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                  onClick={() => setIsMuted(!isMuted)}
                  className={`inline-flex items-center justify-center p-2 rounded-full transition-all shadow-md cursor-pointer ${
                    isMuted 
                      ? 'bg-red-100 text-red-600 border border-red-200' 
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                  title={isMuted ? t('nav.unmute') : t('nav.mute')}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </motion.button>
              </div>
            </motion.header>
          </div>
        )}

        <main 
          ref={scrollRef}
          className={`flex-1 relative ${isKioskInterview ? 'overflow-hidden flex flex-col p-0 m-0' : 'overflow-y-auto overflow-x-hidden pt-24 sm:pt-28'}`}
          tabIndex={-1}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`w-full ${isKioskInterview ? 'h-full flex-1 flex flex-col overflow-hidden' : 'min-h-full flex flex-col'}`}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
