import { LiquidButton } from '../components/ui/button';
/**
 * SwasthyaSync — Conversational Intake Screen (v5)
 *
 * Updates:
 *  - Rigid non-scrolling 100vh kiosk layout (sticky header, sticky controls)
 *  - Fixed speaker attribution bug (proper "You (Patient)" vs "Swasthya AI")
 *  - Live Clinical Summary parsed into structured badges (ClinicalSummaryBadge)
 *  - Touch buttons enriched with universal medical emojis and bilingual subtitles
 *  - High-touch targets for non-formally educated rural citizens
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Mic, TriangleAlert, SkipForward, Volume2, VolumeX, Send, ArrowLeft, Loader2, Globe, Bot, User, Sparkles, X, ChevronDown } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';
import type { OrbState } from '../components/AbstractOrb';
import type { UIInstruction } from '../hooks/useConversation';
import { useSarvamSTT } from '../hooks/useSarvamSTT';
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import { useWordTyping } from '../hooks/useWordTyping';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { ClinicalSummaryBadge } from '../components/ClinicalSummaryBadge';
import { getMedicalOptionVisual } from '../utils/medicalIcons';
import { AyushChecklistModal, ALL_25_AYUSH_CHECKS, parseSummaryMap, getAyushCheckValue } from '../components/AyushChecklistModal';

const LANGUAGE_DISPLAY: Record<string, { flag: string; name: string }> = {
  'hi-IN': { flag: '🇮🇳', name: 'हिंदी (Hindi)' },
  'ta-IN': { flag: '🇮🇳', name: 'தமிழ் (Tamil)' },
  'te-IN': { flag: '🇮🇳', name: 'తెలుగు (Telugu)' },
  'kn-IN': { flag: '🇮🇳', name: 'ಕನ್ನಡ (Kannada)' },
  'bn-IN': { flag: '🇮🇳', name: 'বাংলা (Bengali)' },
  'mr-IN': { flag: '🇮🇳', name: 'मराठी (Marathi)' },
  'gu-IN': { flag: '🇮🇳', name: 'ગુજરાતી (Gujarati)' },
  'ml-IN': { flag: '🇮🇳', name: 'മലയാളം (Malayalam)' },
  'pa-IN': { flag: '🇮🇳', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  'or-IN': { flag: '🇮🇳', name: 'ଓଡ଼ିଆ (Odia)' },
  'en-IN': { flag: '🇮🇳', name: 'English (IN)' },
};

interface Props {
  ui: UIInstruction;
  orbState: OrbState;
  isProcessing: boolean;
  onTap: (value: string) => void;
  onVoice: (transcript: string, detectedLanguage?: string) => void;
  onSkip: () => void;
  onBack: () => void;
  onRedflag: () => void;
}

export function Screen3_ConversationalIntake({
  ui,
  orbState,
  isProcessing,
  onTap,
  onVoice,
  onSkip,
  onBack,
  onRedflag,
}: Props) {
  const { t } = useTranslation();
  const { speak, stop: stopTTS, isSpeaking } = useSarvamTTS();
  const [inputText, setInputText] = useState('');
  const [leftPanelTab, setLeftPanelTab] = useState<'transcript' | 'all_fields'>('transcript');
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isAyush = Boolean(
    (ui?.clinic_mode && ['ayush', 'ayur', 'panch'].some(m => String(ui.clinic_mode).toLowerCase().includes(m))) ||
    (typeof ui?.section_summary === 'string' && ui?.section_summary.includes('prakriti_'))
  );

  const collectedMap = useMemo(() => {
    return parseSummaryMap(ui?.section_summary);
  }, [ui?.section_summary]);

  const collectedFieldCount = useMemo(() => {
    if (!ui?.section_summary) return 0;
    const lines = ui.section_summary.split('\n');
    return lines.filter(l => l.includes(':') && !['Chief Complaint', 'Category', 'Patient', 'vitals', 'BMI', 'weight'].some(h => l.startsWith(h))).length;
  }, [ui?.section_summary]);

  // Track the last prompt to avoid re-speaking the same one
  const lastSpokenPromptRef = useRef<string>('');

  // Indic word-by-word typing effect for Sarvam STT speech input
  const {
    isTyping: isTypingVoice,
    displayedText: displayedVoiceText,
    activeLanguage: typingLanguage,
    startTyping: startVoiceTyping,
    cancelTyping: cancelVoiceTyping,
  } = useWordTyping({
    baseWordDelayMs: 65,
    punctuationDelayMs: 90,
    maxTotalDurationMs: 1300,
    completionPauseMs: 400,
  });

  // STT callback: starts typing in the exact native Indic script
  const handleSTTResult = useCallback((result: { transcript: string; language_code: string }) => {
    if (result.transcript) {
      console.log('[Screen3] STT transcript received in native script:', result.transcript, '| lang:', result.language_code);
      startVoiceTyping(result.transcript, result.language_code, () => {
        console.log('[Screen3] Word typing complete — sending voice input to conversational intake');
        onVoice(result.transcript, result.language_code);
        setInputText('');
      });
    }
  }, [onVoice, startVoiceTyping]);

  const { isRecording, isTranscribing, startRecording, stopRecording, error: sttError, audioLevel } =
    useSarvamSTT(ui.language || 'hi-IN', handleSTTResult);

  // Mirror typing effect to quick text input bar in real time
  useEffect(() => {
    if (isTypingVoice) {
      setInputText(displayedVoiceText);
    }
  }, [isTypingVoice, displayedVoiceText]);

  // Auto-TTS: speak the prompt whenever a new one arrives
  useEffect(() => {
    if (
      ui.prompt &&
      !isProcessing &&
      ui.prompt !== lastSpokenPromptRef.current
    ) {
      lastSpokenPromptRef.current = ui.prompt;
      const textToSpeak = ui.ack ? `${ui.ack}. ${ui.prompt}` : ui.prompt;
      speak(textToSpeak, ui.language || 'hi-IN');
    }
  }, [ui.prompt, ui.ack, ui.language, isProcessing, speak]);

  // Auto-scroll chat on updates, speech typing, or recording
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ui.conversation_history, displayedVoiceText, isRecording, isTranscribing]);

  const handleMicPress = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopTTS();
    cancelVoiceTyping();
    await startRecording(e);
  }, [startRecording, stopTTS, cancelVoiceTyping]);

  const handleMicRelease = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopRecording(e);
  }, [stopRecording]);

  const handleOptionTap = useCallback((opt: { label: string; value?: string }) => {
    stopTTS();
    cancelVoiceTyping();
    const backendValue = opt.value || opt.label;
    onTap(backendValue);
  }, [onTap, stopTTS, cancelVoiceTyping]);

  const handleTextSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    stopTTS();
    cancelVoiceTyping();
    onVoice(inputText.trim(), ui.language || 'en-IN');
    setInputText('');
  }, [inputText, stopTTS, onVoice, ui.language, cancelVoiceTyping]);

  const progress = ui.progress;
  const effectiveOrbState: OrbState = isRecording
    ? 'listening'
    : isTranscribing || isTypingVoice
    ? 'processing'
    : isSpeaking
    ? 'speaking'
    : orbState;
  const micRingOpacity = isRecording ? Math.min(audioLevel * 2, 1) : 0;

  const renderPanelContent = () => (
    <>
      {/* Mode-specific Tab Switcher: Only render tabs if in AYUSH mode */}
      {isAyush && (
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl mb-2.5 shrink-0 border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setLeftPanelTab('transcript')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              leftPanelTab === 'transcript'
                ? 'bg-white text-slate-800 shadow-2xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>💬</span>
            <span>{t('interview.conversation')}</span>
          </button>
          <button
            type="button"
            onClick={() => setLeftPanelTab('all_fields')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              leftPanelTab === 'all_fields'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:text-emerald-950 hover:bg-emerald-50'
            }`}
          >
            <span>🌿</span>
            <span>AYUSH 25 Checks</span>
            {collectedFieldCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                leftPanelTab === 'all_fields' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {collectedFieldCount}/25
              </span>
            )}
          </button>
        </div>
      )}

      {(!isAyush || leftPanelTab === 'transcript') ? (
        <>
          {/* Live Clinical Summary Badge Card */}
          <div className="mb-2 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('interview.live_summary')}</span>
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full shadow-2xs">
                AUTO-EXTRACT
              </span>
            </div>
            <ClinicalSummaryBadge summary={ui.section_summary} clinicMode={ui.clinic_mode} emptyText={t('interview.waiting_info')} />
          </div>

          {/* Conversation Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5 shrink-0">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {t('interview.conversation')}
            </h3>
            <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide">
              LIVE TRANSCRIPT
            </span>
          </div>

          {/* Conversation Message List (Independent Internal Scroll) */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 scrollbar-thin scrollbar-thumb-slate-200 min-h-[120px]">
            {ui.conversation_history && ui.conversation_history.length > 0 ? (
              ui.conversation_history.map((msg, i) => {
                const isPatient = msg.role === 'patient' || msg.role === 'user';
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: isPatient ? 0.98 : 1 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    key={i} 
                    className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                  >
                    <span className={`text-[11px] font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${
                      isPatient ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {isPatient ? (
                        <>
                          <span>{t('interview.you')}</span>
                          <User className="w-3 h-3 text-blue-500" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t('interview.ai_doctor')}</span>
                        </>
                      )}
                    </span>
                    <div className={`px-3.5 py-2.5 rounded-2xl max-w-[92%] text-sm font-medium leading-relaxed shadow-card ${
                      isPatient 
                        ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-600/15' 
                        : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/90'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm font-medium py-8">
                <span className="block mb-1.5 text-2xl">👋</span>
                <span>Say hello or speak your symptom to start!</span>
              </div>
            )}

            {/* LIVE VOICE INPUT STREAMING & TYPING BUBBLE */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-end"
                >
                  <span className="text-[11px] font-bold mb-1 text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{t('interview.you')} (Listening...)</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  </span>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-xs bg-red-50/90 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-card">
                    <div className="flex items-center gap-1">
                      <span className="w-1 bg-red-500 rounded-full transition-all duration-75" style={{ height: `${8 + Math.round(audioLevel * 16)}px` }} />
                      <span className="w-1 bg-red-600 rounded-full transition-all duration-75" style={{ height: `${12 + Math.round(audioLevel * 20)}px` }} />
                      <span className="w-1 bg-red-500 rounded-full transition-all duration-75" style={{ height: `${6 + Math.round(audioLevel * 12)}px` }} />
                    </div>
                    <span>Listening to your speech... / सुन रहे हैं...</span>
                  </div>
                </motion.div>
              )}

              {isTranscribing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-end"
                >
                  <span className="text-[11px] font-bold mb-1 text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{t('interview.you')}</span>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                  </span>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-xs bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-card">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Analyzing voice with Sarvam AI...</span>
                  </div>
                </motion.div>
              )}

              {isTypingVoice && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-end"
                >
                  <span className="text-[11px] font-bold mb-1 text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border border-blue-200 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                      <span>{LANGUAGE_DISPLAY[typingLanguage]?.name || 'NATIVE VOICE'}</span>
                    </span>
                    <span>{t('interview.you')}</span>
                    <User className="w-3 h-3 text-blue-500" />
                  </span>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white max-w-[92%] text-sm sm:text-base font-medium leading-relaxed shadow-card shadow-blue-600/25 border border-blue-400/40">
                    <span className="break-words font-sans">{displayedVoiceText}</span>
                    <span className="inline-block w-2 h-4 ml-1.5 bg-white animate-pulse align-middle rounded-xs" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={chatEndRef} className="h-2" />
          </div>
        </>
      ) : (
        /* ALL FIELDS FULL-HEIGHT INSPECTOR VIEW */
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col min-h-[140px]">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>{isAyush ? '🌿' : '📋'}</span>
              <span>{isAyush ? '25 CCRAS Checks' : 'All Clinical Fields'}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChecklistModalOpen(true)}
                className="text-[10px] font-extrabold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                title="Open full screen modal"
              >
                <span>🔍</span>
                <span>Expand</span>
              </button>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-full">
                100% DB
              </span>
            </div>
          </div>

          {isAyush ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
              {/* Live Prakriti Dominance Mini Banner */}
              <ClinicalSummaryBadge summary={ui.section_summary} clinicMode={ui.clinic_mode} />

              {/* 25 Authentic CCRAS Checks List */}
              <div className="border-t border-slate-200 pt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 px-1">
                  <span>CCRAS Protocol Checks</span>
                  <span className="text-emerald-700 font-bold">{collectedFieldCount}/25 Verified</span>
                </div>

                {ALL_25_AYUSH_CHECKS.map((item) => {
                  const val = getAyushCheckValue(item, collectedMap);
                  const isDone = Boolean(val);
                  const isCurrent = ui.current_field_id === item.id || Boolean(item.aliases && ui.current_field_id && item.aliases.includes(ui.current_field_id));

                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isDone
                          ? 'bg-emerald-50/70 border-emerald-200/80 shadow-2xs'
                          : isCurrent
                          ? 'bg-amber-50/90 border-amber-300 shadow-2xs ring-1 ring-amber-200'
                          : 'bg-white border-slate-200/70 opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-0.5">
                        <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 truncate">
                          <span className="text-sm shrink-0">{item.icon}</span>
                          <span className="truncate">{item.ayurvedicTerm}</span>
                        </span>
                        {isDone ? (
                          <span className="text-[9px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5">
                            <span>✓</span>
                            <span>Done</span>
                          </span>
                        ) : isCurrent ? (
                          <span className="text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-0.2 rounded-full shrink-0 animate-pulse">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-800 font-medium pl-5 truncate">
                        {item.ayurvedicHindi}
                      </div>
                      {isDone && (
                        <div className="mt-1 pl-5 text-[10px] font-bold text-emerald-950 bg-white/80 p-1 rounded-md border border-emerald-200/70 truncate">
                          {val}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ClinicalSummaryBadge summary={ui.section_summary} clinicMode={ui.clinic_mode} showAllFields={true} />
          )}
        </div>
      )}
    </>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden select-none relative"
    >
      {/* ─────────────────────────────────────────────────────────────
          DESKTOP LEFT PANEL: Structured Clinical Summary & Chat Transcript
          (Hidden on mobile, side-by-side on md+ screens)
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:w-[320px] lg:w-[360px] bg-white md:border-r border-slate-200 p-4 flex-col h-full overflow-hidden shrink-0 shadow-xs z-10">
        {renderPanelContent()}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE BOTTOM SHEET DRAWER: Clinical Summary & Transcript
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileSummaryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSummaryOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[82dvh] md:hidden border-t border-slate-200 overflow-hidden"
            >
              {/* Drag Handle & Header */}
              <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />
              <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{isAyush ? '🌿' : '📋'}</span>
                  <span className="font-extrabold text-sm text-slate-800">
                    {isAyush ? 'AYUSH Summary & 25 Checks' : 'Live Clinical Summary & Transcript'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSummaryOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close summary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto p-3.5 flex flex-col min-h-0">
                {renderPanelContent()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MAIN KIOSK INTERACTION VIEWPORT (100% Height on Mobile & Desktop)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between p-2.5 xs:p-3 sm:p-5 h-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        
        {/* Top Progress & Badges (Pinned) */}
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 shrink-0">
          {/* Mobile-Only Summary Toggle Pill */}
          <div className="flex items-center justify-between w-full md:hidden mb-0.5 shrink-0 px-1">
            <button
              type="button"
              onClick={() => setMobileSummaryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/90 shadow-2xs rounded-full text-xs font-bold text-slate-700 active:scale-95 transition-transform cursor-pointer hover:bg-slate-50"
            >
              <span>{isAyush ? '🌿' : '📋'}</span>
              <span>{isAyush ? `AYUSH Checks (${collectedFieldCount}/25)` : 'Summary & Transcript'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              LIVE SYNC
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {isAyush ? (
              <span className="px-3.5 py-1 bg-gradient-to-r from-emerald-100 via-teal-100 to-amber-100 text-emerald-950 border border-emerald-300 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-2xs flex items-center gap-1.5">
                <span className="text-sm">🌿</span>
                <span>
                  {ui.section_label === 'PRAKRITI' 
                    ? 'CCRAS PRAKRITI INTAKE' 
                    : ui.section_label === 'SAFETY_CHECKS' || (typeof ui.macro_state === 'string' && ui.macro_state.includes('SAFETY'))
                    ? 'AYUSH SURAKSHA (SAFETY CHECKS)'
                    : ui.section_label === 'HPI' || (typeof ui.macro_state === 'string' && ui.macro_state.includes('HPI'))
                    ? 'NIDANA & ROGA PARIKSHA'
                    : (ui.section_label || 'AYUSH INTAKE')}
                </span>
                <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1">Govt SOP</span>
              </span>
            ) : (
              <span className="px-3.5 py-1 bg-blue-100/70 text-blue-700 border border-blue-200/70 rounded-full text-xs font-extrabold uppercase tracking-widest shadow-2xs">
                {typeof (ui.section_label || ui.macro_state) === 'string' ? (ui.section_label || ui.macro_state) : String(ui.section_label || ui.macro_state)}
              </span>
            )}
            {isAyush && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                <span>NAMASTE / CCRAS Scale</span>
              </span>
            )}
            {ui.language && ui.language !== 'en-IN' && (
              <span className="px-3 py-1 bg-emerald-100/70 text-emerald-700 border border-emerald-200/70 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                <Globe className="w-3.5 h-3.5" />
                {ui.language}
              </span>
            )}
            <LiquidButton
              onClick={onRedflag}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors border border-red-200 cursor-pointer shadow-2xs"
              title="Simulate Red Flag for Triage Demo"
            >
              <TriangleAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('interview.simulate_alert')}</span>
            </LiquidButton>
          </div>

          {progress && (
            <div className="w-full max-w-md">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1 tracking-wide uppercase">
                <span>{(progress as any).label || `Question ${progress.done} of ${progress.total}`}</span>
                <span className="text-blue-600 font-extrabold">{(progress as any).percent ?? Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(progress as any).percent ?? (progress.done / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Option to see all 25 Ayurvedic checks (ONLY in AYUSH MODE) */}
          {isAyush && (
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => setChecklistModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-950 border-emerald-300 hover:scale-[1.02]"
                title="Click to view all 25 Ayurvedic checks"
              >
                <span>🌿</span>
                <span>View All 25 AYUSH Checks (CCRAS Protocol)</span>
                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-emerald-700 text-white">
                  {collectedFieldCount}/25
                </span>
                <span className="text-[10px] text-slate-400 font-bold">🔍</span>
              </button>
            </div>
          )}
        </div>

        {/* Center Zone: Orb, Prompt & Accessible Emoji Options (Scrollable internally if needed) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto w-full max-w-4xl mx-auto px-2 py-2 text-center">
          
          {/* AI Medical Orb */}
          <div className="relative mb-2 sm:mb-3 shrink-0">
            <AbstractOrb interactionState={effectiveOrbState} size="sm" />
            <AnimatePresence>
              {isSpeaking && (
                <motion.div 
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-card whitespace-nowrap"
                >
                  <Volume2 className="w-3 h-3 animate-pulse text-blue-600" />
                  <span>SPEAKING</span>
                </motion.div>
              )}
              {isRecording && (
                <motion.div 
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 shadow-card whitespace-nowrap"
                >
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span>LISTENING</span>
                </motion.div>
              )}
              {isTranscribing && (
                <motion.div 
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200 shadow-card whitespace-nowrap"
                >
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                  <span>ANALYZING VOICE</span>
                </motion.div>
              )}
              {isTypingVoice && (
                <motion.div 
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-200 shadow-card whitespace-nowrap max-w-[260px] truncate"
                >
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                  <span>TYPING VOICE INPUT</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Acknowledgment */}
          {ui.ack && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs sm:text-base text-emerald-600 font-semibold mb-1 max-w-lg shrink-0"
            >
              {typeof ui.ack === 'string' ? ui.ack : JSON.stringify(ui.ack)}
            </motion.p>
          )}

          {/* Primary Question Heading */}
          <h2 className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 leading-snug px-2 sm:px-3 my-1 sm:my-2 max-w-3xl shrink-0">
            {isProcessing ? (
              <span className="flex flex-col items-center gap-2 text-blue-600/70 my-1">
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                <span className="text-sm sm:text-base font-bold animate-pulse">{t('interview.processing')}</span>
              </span>
            ) : (
              typeof ui.prompt === 'string' ? ui.prompt : JSON.stringify(ui.prompt)
            )}
          </h2>
          
          {sttError && (
            <div className="bg-red-50 text-red-600 px-3.5 py-1.5 rounded-xl text-xs font-medium border border-red-200 flex items-center gap-2 my-1 sm:my-2 shrink-0">
              <TriangleAlert className="w-4 h-4" />
              <span>{sttError}</span>
            </div>
          )}

          {/* Dynamic Option Cards with Medical Emojis */}
          {Array.isArray(ui.options) && ui.options.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full max-w-4xl my-1 sm:my-2 px-1">
              {ui.options.map((opt, idx) => {
                const label = typeof opt === 'string' ? opt : (opt.label || String(opt));
                const labelTranslated = typeof opt === 'object' ? opt.label_translated : undefined;
                const visual = getMedicalOptionVisual(label, labelTranslated);
                const hasSubtitle = Boolean(labelTranslated && labelTranslated !== label);

                return (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2), ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.015, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    key={idx}
                    id={`option-${idx}`}
                    onClick={() => handleOptionTap(opt as any)}
                    disabled={isProcessing || isRecording || isTranscribing || isTypingVoice}
                    className={`flex items-center gap-2.5 xs:gap-3.5 px-3.5 py-2.5 xs:px-5 xs:py-3 sm:px-6 sm:py-3.5 bg-white border-2 ${visual.badgeBorder} rounded-2xl hover:shadow-card-hover active:scale-[0.97] transition-[transform,box-shadow,border-color,background-color] duration-150 text-left shadow-card border-b-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[50px] xs:min-h-[56px] min-w-[135px] xs:min-w-[160px] sm:min-w-[210px] flex-1 max-w-[340px]`}
                  >
                    <span className="text-xl xs:text-2xl sm:text-3xl shrink-0 select-none leading-none">
                      {visual.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs xs:text-sm sm:text-base font-extrabold text-slate-800 leading-snug whitespace-normal break-words">
                        {labelTranslated || label}
                      </span>
                      {hasSubtitle && (
                        <span className="block text-[10px] xs:text-xs font-semibold text-slate-500 whitespace-normal break-words mt-0.5">
                          {label}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BOTTOM CONTROLS: Firmly Anchored Sticky Dock
        ───────────────────────────────────────────────────────────── */}
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-slate-200/80 shrink-0">
          
          {/* Quick text input form */}
          <form onSubmit={handleTextSubmit} className="flex w-full gap-2 relative">
            <div className={`w-full flex items-center bg-white border ${
              isTypingVoice ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10' : 'border-slate-200'
            } rounded-full pl-4 pr-12 xs:pl-5 xs:pr-14 py-2 xs:py-2.5 shadow-card focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-card-hover transition-[border-color,box-shadow] duration-200`}>
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isProcessing || isRecording || isTranscribing || isTypingVoice}
                placeholder={isTypingVoice ? "Typing recognized speech..." : t('interview.type_response')}
                className="w-full bg-transparent border-none text-xs xs:text-sm sm:text-base font-semibold text-slate-800 focus:outline-none disabled:opacity-50 placeholder:text-slate-400"
              />
            </div>
            <LiquidButton 
              type="submit" 
              aria-label="Send message"
              disabled={isProcessing || isRecording || isTranscribing || isTypingVoice || !inputText.trim()}
              className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
            </LiquidButton>
          </form>

          {/* Action Dock: Back, Replay, Large Mic Button, Skip */}
          <div className="flex items-center justify-between w-full gap-1.5 xs:gap-2">
            
            {/* Back Button */}
            <LiquidButton
              id="btn-back"
              onClick={onBack}
              className="group flex items-center justify-center gap-1 xs:gap-1.5 px-2.5 xs:px-3.5 sm:px-5 py-2 xs:py-2.5 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 transition-[transform,background-color,color] duration-150 active:scale-[0.97] text-xs sm:text-sm cursor-pointer shrink-0 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 xs:w-4 xs:h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden xs:inline">{t('phone.back')}</span>
            </LiquidButton>

            {/* Central Voice Controls */}
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
              <LiquidButton
                id="btn-tts-toggle"
                type="button"
                aria-label={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                onClick={() => isSpeaking ? stopTTS() : speak(ui.prompt || '', ui.language || 'hi-IN')}
                title={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                className="p-2 xs:p-2.5 rounded-full text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/70 transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] shrink-0 cursor-pointer shadow-card"
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5" />}
              </LiquidButton>

              {/* Hold to Speak Button */}
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full bg-blue-500 transition-opacity duration-75"
                  style={{
                    opacity: micRingOpacity * 0.4,
                    transform: `scale(${1 + audioLevel * 0.4})`,
                    transition: 'transform 0.05s, opacity 0.05s',
                  }}
                />
                <LiquidButton
                  id="btn-mic"
                  type="button"
                  onMouseDown={handleMicPress}
                  onMouseUp={handleMicRelease}
                  onTouchStart={handleMicPress}
                  onTouchEnd={handleMicRelease}
                  onTouchCancel={handleMicRelease}
                  disabled={isProcessing || isTranscribing || isTypingVoice}
                  className={`relative flex items-center justify-center gap-1.5 xs:gap-2 px-3.5 xs:px-5 sm:px-8 py-2 xs:py-2.5 sm:py-3 rounded-full font-extrabold text-white transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97] shadow-card-hover text-xs sm:text-base ${
                    isRecording
                      ? 'bg-red-600 shadow-red-600/40 scale-102 animate-pulse'
                      : isTranscribing || isTypingVoice
                      ? 'bg-blue-600/90 shadow-blue-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 min-w-[130px] xs:min-w-[150px] sm:min-w-[190px]`}
                >
                  {isRecording ? (
                    <>
                      <Mic className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white animate-bounce" />
                      <span>{t('interview.release_to_send')}</span>
                    </>
                  ) : isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : isTypingVoice ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
                      <span>Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white" />
                      <span>{t('interview.hold_to_speak')}</span>
                    </>
                  )}
                </LiquidButton>
              </div>
            </div>

            {/* Skip Button */}
            <div className="flex justify-end shrink-0">
              {ui.can_skip ? (
                <LiquidButton
                  id="btn-skip"
                  type="button"
                  onClick={onSkip}
                  className="flex items-center gap-1 px-2.5 xs:px-3 sm:px-5 py-2 xs:py-2.5 rounded-full font-bold text-slate-600 hover:bg-slate-100 transition-colors text-xs sm:text-sm cursor-pointer"
                  title="Skip this question"
                >
                  <span className="hidden xs:inline">{t('docs.skip')}</span>
                  <SkipForward className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                </LiquidButton>
              ) : (
                <div className="w-8 xs:w-10 sm:w-16" /> /* Placeholder to keep mic centered */
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full 25-Check AYUSH & Clinical Inspector Modal (ONLY in AYUSH MODE) */}
      {isAyush && (
        <AyushChecklistModal
          isOpen={checklistModalOpen}
          onClose={() => setChecklistModalOpen(false)}
          summaryText={ui.section_summary}
          currentFieldId={ui.current_field_id}
          progressTotal={25}
          progressDone={collectedFieldCount}
        />
      )}
    </motion.div>
  );
}

