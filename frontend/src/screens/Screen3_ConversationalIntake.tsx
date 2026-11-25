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
import { Mic, TriangleAlert, SkipForward, Volume2, VolumeX, Send, ArrowLeft, Loader2, Globe, Bot, User, Sparkles, X, MessageSquare, Leaf, ClipboardList, Search, Check } from 'lucide-react';
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
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
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
            <Leaf className="w-4 h-4" aria-hidden="true" />
            <span>AYUSH 25 Checks</span>
            {collectedFieldCount > 0 && (
              <span className={`text-xs font-extrabold px-1.5 py-0.2 rounded-full ${
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
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <span>{t('interview.live_summary')}</span>
              </h2>
            </div>
            <ClinicalSummaryBadge summary={ui.section_summary} clinicMode={ui.clinic_mode} emptyText={t('interview.waiting_info')} />
          </div>

          {/* Conversation Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5 shrink-0">
            <h2 className="text-sm font-semibold text-slate-800">
              {t('interview.conversation')}
            </h2>
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
                    <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${
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
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm font-medium py-8">
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
                  <span className="text-xs font-bold mb-1 text-red-500 uppercase tracking-wider flex items-center gap-1.5">
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
                  <span className="text-xs font-bold mb-1 text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
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
                  <span className="text-xs font-bold mb-1 text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-extrabold tracking-wider border border-blue-200 flex items-center gap-1">
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
              {isAyush ? <Leaf className="w-4 h-4" aria-hidden="true" /> : <ClipboardList className="w-4 h-4" aria-hidden="true" />}
              <span>{isAyush ? '25 CCRAS Checks' : 'All Clinical Fields'}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChecklistModalOpen(true)}
                className="text-xs font-extrabold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                title="Open full screen modal"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Expand</span>
              </button>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-full">
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
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500 mb-1 px-1">
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
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                          <span className="text-sm shrink-0">{item.icon}</span>
                          <span className="truncate">{item.ayurvedicTerm}</span>
                        </span>
                        {isDone ? (
                          <span className="text-xs font-extrabold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Done</span>
                          </span>
                        ) : isCurrent ? (
                          <span className="text-xs font-extrabold bg-amber-500 text-white px-1.5 py-0.2 rounded-full shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-800 font-medium pl-5 truncate">
                        {item.ayurvedicHindi}
                      </div>
                      {isDone && (
                        <div className="mt-1 pl-5 text-xs font-bold text-emerald-950 bg-white/80 p-1 rounded-md border border-emerald-200/70 truncate">
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
              className="fixed inset-0 bg-slate-900/60 z-40 md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[82dvh] md:hidden border-t border-slate-200 overflow-hidden"
            >
              {/* Drag Handle & Header */}
              <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />
              <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAyush ? <Leaf className="w-5 h-5 text-emerald-700" aria-hidden="true" /> : <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />}
                  <span className="font-extrabold text-sm text-slate-800">
                    {isAyush ? 'AYUSH Summary & 25 Checks' : 'Live Clinical Summary & Transcript'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSummaryOpen(false)}
                  className="p-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
      <div className="flex-1 flex flex-col justify-between p-3 sm:p-5 lg:p-6 h-full overflow-hidden bg-slate-50">
        
        {/* ── TOP: where the patient is in the interview ─────────────── */}
        {(() => {
          const pct = progress ? Math.round(((progress as any).percent ?? (progress.done / Math.max(progress.total, 1)) * 100)) : null;
          const rawSection = String(ui.section_label || ui.macro_state || '');
          const ayushSection =
            ui.section_label === 'PRAKRITI' ? 'Prakriti (body constitution)'
            : ui.section_label === 'SAFETY_CHECKS' || rawSection.includes('SAFETY') ? 'Safety checks'
            : ui.section_label === 'HPI' || rawSection.includes('HPI') ? 'Nidana · about your illness'
            : null;
          const SECTION_NAMES: Record<string, string> = {
            HPI: 'About your illness', CHIEF_COMPLAINT: 'Main problem', CC: 'Main problem',
            ROS: 'Other symptoms', PMH: 'Past illnesses', PAST_HISTORY: 'Past illnesses',
            MEDICATIONS: 'Medicines', ALLERGIES: 'Allergies', FAMILY_HISTORY: 'Family history',
            SOCIAL_HISTORY: 'Daily habits', VITALS: 'Vitals', SAFETY_CHECKS: 'Safety checks',
          };
          const section = (isAyush && ayushSection) || SECTION_NAMES[rawSection.toUpperCase()] || (rawSection
            ? rawSection.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
            : '');
          const ringC = 2 * Math.PI * 14;
          return (
            <div className="w-full max-w-4xl mx-auto shrink-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base text-slate-700 min-w-0 truncate">
                  {progress && <span className="font-semibold text-slate-900">Question {Math.min(progress.done + 1, progress.total)} of about {progress.total}</span>}
                  {section && <span className="text-slate-500">{progress ? ' · ' : ''}{section}</span>}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {ui.language && ui.language !== 'en-IN' && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600">
                      <Globe className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      {LANGUAGE_DISPLAY[ui.language]?.name || ui.language}
                    </span>
                  )}
                  {isAyush && (
                    <button
                      type="button"
                      onClick={() => setChecklistModalOpen(true)}
                      className="tap inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white pl-1.5 pr-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                      aria-label={`AYUSH checks: ${collectedFieldCount} of 25 recorded. Open checklist`}
                    >
                      <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90" aria-hidden="true">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#d1fae5" strokeWidth="4" />
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={ringC} strokeDashoffset={ringC * (1 - Math.min(collectedFieldCount, 25) / 25)} />
                      </svg>
                      <span className="tabular-nums">{collectedFieldCount}/25</span>
                      <span className="hidden sm:inline">AYUSH checks</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileSummaryOpen(true)}
                    className="md:hidden tap inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" aria-hidden="true" />
                    Summary
                  </button>
                </div>
              </div>
              {pct !== null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Interview progress">
                  <div className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })()}

        {/* ── MIDDLE: the question and its answers ─────────────────────── */}
        <div className="flex-1 flex flex-col items-center min-h-0 overflow-y-auto w-full max-w-4xl mx-auto py-4 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
          <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="shrink-0">
              <AbstractOrb interactionState={effectiveOrbState} size="sm" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left sm:pt-2">
              {ui.ack && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-1 text-base font-semibold text-emerald-700">
                  {typeof ui.ack === 'string' ? ui.ack : JSON.stringify(ui.ack)}
                </motion.p>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug text-slate-900 text-balance" aria-live="polite">
                {isProcessing ? (
                  <span className="inline-flex items-center gap-3 text-xl sm:text-2xl font-semibold text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" aria-hidden="true" />
                    {t('interview.processing')}
                  </span>
                ) : (
                  typeof ui.prompt === 'string' ? ui.prompt : JSON.stringify(ui.prompt)
                )}
              </h1>
              {ui.prompt_subtitle && !isProcessing && (
                <p className="mt-2 text-lg text-slate-600">{ui.prompt_subtitle}</p>
              )}
            </div>
          </div>

          {sttError && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-base font-medium text-red-700">
              <TriangleAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{sttError}</span>
            </div>
          )}

          {Array.isArray(ui.options) && ui.options.length > 0 && (
            <div className="mt-6 grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ui.options.map((opt, idx) => {
                const label = typeof opt === 'string' ? opt : (opt.label || String(opt));
                const labelTranslated = typeof opt === 'object' ? opt.label_translated : undefined;
                const visual = getMedicalOptionVisual(label, labelTranslated);
                const hasSubtitle = Boolean(labelTranslated && labelTranslated !== label);
                return (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(idx * 0.025, 0.15), ease: [0.16, 1, 0.3, 1] }}
                    key={idx}
                    id={`option-${idx}`}
                    type="button"
                    onClick={() => handleOptionTap(opt as any)}
                    disabled={isProcessing || isRecording || isTranscribing || isTypingVoice}
                    className={`flex h-full min-h-[72px] w-full items-center gap-4 rounded-xl border-2 ${visual.badgeBorder} bg-white px-4 py-3 text-left shadow-card transition-[box-shadow,background-color] duration-150 hover:shadow-card-hover active:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                  >
                    <span className="text-3xl leading-none shrink-0 select-none" aria-hidden="true">{visual.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold leading-snug text-slate-900 break-words">{labelTranslated || label}</span>
                      {hasSubtitle && <span className="mt-0.5 block text-sm text-slate-500 break-words">{label}</span>}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BOTTOM: controls where the hand rests ─────────────────────── */}
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 pt-3 border-t border-slate-200 shrink-0">
          <form onSubmit={handleTextSubmit} className="relative flex w-full">
            <label htmlFor="interview-text" className="sr-only">{t('interview.type_response')}</label>
            <input
              id="interview-text"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing || isRecording || isTranscribing || isTypingVoice}
              placeholder={isTypingVoice ? 'Writing down what you said…' : t('interview.type_response')}
              className={`h-12 w-full rounded-xl border bg-white pl-4 pr-14 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 ${isTypingVoice ? 'border-blue-600' : 'border-slate-300'}`}
            />
            <button
              type="submit"
              aria-label="Send answer"
              disabled={isProcessing || isRecording || isTranscribing || isTypingVoice || !inputText.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex justify-start">
              <button
                id="btn-back"
                type="button"
                onClick={onBack}
                className="tap-kiosk inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('phone.back')}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-tts-toggle"
                type="button"
                aria-label={isSpeaking ? 'Stop reading aloud' : 'Read the question again'}
                title={isSpeaking ? 'Stop reading aloud' : 'Read the question again'}
                onClick={() => isSpeaking ? stopTTS() : speak(ui.prompt || '', ui.language || 'hi-IN')}
                className="tap-kiosk w-14 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isSpeaking ? <VolumeX className="w-5 h-5 text-red-600" aria-hidden="true" /> : <Volume2 className="w-5 h-5" aria-hidden="true" />}
              </button>

              <div className="relative">
                <div
                  className="absolute inset-0 rounded-xl bg-red-500 pointer-events-none"
                  style={{ opacity: micRingOpacity * 0.35, transform: `scale(${1 + audioLevel * 0.25})`, transition: 'transform 0.05s, opacity 0.05s' }}
                  aria-hidden="true"
                />
                <button
                  id="btn-mic"
                  type="button"
                  onMouseDown={handleMicPress}
                  onMouseUp={handleMicRelease}
                  onTouchStart={handleMicPress}
                  onTouchEnd={handleMicRelease}
                  onTouchCancel={handleMicRelease}
                  disabled={isProcessing || isTranscribing || isTypingVoice}
                  aria-pressed={isRecording}
                  className={`relative tap-kiosk sm:min-w-[220px] inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 sm:px-6 text-base sm:text-lg font-semibold text-white shadow-card transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                    isRecording ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isTranscribing || isTypingVoice
                    ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    : <Mic className="w-5 h-5" aria-hidden="true" />}
                  <span>{isRecording ? t('interview.release_to_send') : t('interview.hold_to_speak')}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              {ui.can_skip && (
                <button
                  id="btn-skip"
                  type="button"
                  onClick={onSkip}
                  className="tap-kiosk inline-flex items-center gap-2 rounded-xl px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span className="hidden sm:inline">{t('docs.skip')}</span>
                  <SkipForward className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* One plain status line instead of floating uppercase chips */}
          <p className="min-h-6 text-center text-base text-slate-600" aria-live="polite">
            {isRecording ? (
              <span className="inline-flex items-center gap-2 font-semibold text-red-700"><span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" aria-hidden="true" />Listening… let go of the button when you finish.</span>
            ) : isTranscribing ? 'Understanding what you said…'
              : isTypingVoice ? 'Writing down what you said…'
              : isSpeaking ? (
                <span className="inline-flex items-center gap-2 text-blue-700"><Volume2 className="w-4 h-4 animate-pulse" aria-hidden="true" />Reading the question aloud…</span>
              ) : 'Hold the blue button and speak, or tap an answer.'}
          </p>

          <button
            type="button"
            onClick={onRedflag}
            title="Alerts the triage nurse immediately"
            className="tap-kiosk mx-auto inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-white px-4 text-base font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
          >
            <TriangleAlert className="w-5 h-5" aria-hidden="true" />
            {t('interview.call_nurse')}
          </button>
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

