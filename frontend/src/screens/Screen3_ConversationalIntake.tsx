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

import { useEffect, useCallback, useRef, useState } from 'react';
import { Mic, TriangleAlert, SkipForward, Volume2, VolumeX, Send, ArrowLeft, Loader2, Globe, Bot, User, Sparkles } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';
import type { OrbState } from '../components/AbstractOrb';
import type { UIInstruction } from '../hooks/useConversation';
import { useSarvamSTT } from '../hooks/useSarvamSTT';
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { ClinicalSummaryBadge } from '../components/ClinicalSummaryBadge';
import { getMedicalOptionVisual } from '../utils/medicalIcons';

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track the last prompt to avoid re-speaking the same one
  const lastSpokenPromptRef = useRef<string>('');

  // STT with direct callback
  const handleSTTResult = useCallback((result: { transcript: string; language_code: string }) => {
    if (result.transcript) {
      console.log('[Screen3] STT result received:', result.transcript);
      onVoice(result.transcript, result.language_code);
    }
  }, [onVoice]);

  const { isRecording, startRecording, stopRecording, error: sttError, audioLevel } =
    useSarvamSTT(ui.language || 'hi-IN', handleSTTResult);

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ui.conversation_history]);

  const handleMicPress = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopTTS();
    await startRecording(e);
  }, [startRecording, stopTTS]);

  const handleMicRelease = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopRecording(e);
  }, [stopRecording]);

  const handleOptionTap = useCallback((opt: { label: string; value?: string }) => {
    stopTTS();
    const backendValue = opt.value || opt.label;
    onTap(backendValue);
  }, [onTap, stopTTS]);

  const handleTextSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    stopTTS();
    onVoice(inputText.trim(), ui.language || 'en-IN');
    setInputText('');
  }, [inputText, stopTTS, onVoice, ui.language]);

  const progress = ui.progress;
  const effectiveOrbState: OrbState = isRecording ? 'listening' : isSpeaking ? 'speaking' : orbState;
  const micRingOpacity = isRecording ? Math.min(audioLevel * 2, 1) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden select-none"
    >
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: Structured Clinical Summary & Chat Transcript
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full md:w-[320px] lg:w-[360px] bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col h-[38vh] md:h-full overflow-hidden shrink-0 shadow-xs z-10">
        
        {/* Live Clinical Summary Badge Card */}
        <div className="mb-3.5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('interview.live_summary')}</span>
            </h3>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full shadow-2xs">
              AUTO-EXTRACT
            </span>
          </div>
          <ClinicalSummaryBadge summary={ui.section_summary} emptyText={t('interview.waiting_info')} />
        </div>

        {/* Conversation Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2 shrink-0">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
            {t('interview.conversation')}
          </h3>
          <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide">
            LIVE TRANSCRIPT
          </span>
        </div>

        {/* Conversation Message List (Independent Internal Scroll) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 scrollbar-thin scrollbar-thumb-slate-200">
          {ui.conversation_history && ui.conversation_history.length > 0 ? (
            ui.conversation_history.map((msg, i) => {
              // Fix: Backend uses role='patient', also match 'user'
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
          <div ref={chatEndRef} className="h-2" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: Main Kiosk Interaction Viewport (100% Pinned)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between p-3 sm:p-5 h-[62vh] md:h-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        
        {/* Top Progress & Badges (Pinned) */}
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="px-3.5 py-1 bg-blue-100/70 text-blue-700 border border-blue-200/70 rounded-full text-xs font-extrabold uppercase tracking-widest shadow-2xs">
              {typeof (ui.section_label || ui.macro_state) === 'string' ? (ui.section_label || ui.macro_state) : String(ui.section_label || ui.macro_state)}
            </span>
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
        </div>

        {/* Center Zone: Orb, Prompt & Accessible Emoji Options (Scrollable internally if needed) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto w-full max-w-4xl mx-auto px-2 py-2 text-center">
          
          {/* AI Medical Orb */}
          <div className="relative mb-3 shrink-0">
            <AbstractOrb interactionState={effectiveOrbState} size="sm" />
            <AnimatePresence>
              {isSpeaking && (
                <motion.div 
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-card"
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
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 shadow-card"
                >
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span>LISTENING</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Acknowledgment */}
          {ui.ack && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm sm:text-base text-emerald-600 font-semibold mb-1 max-w-lg shrink-0"
            >
              {typeof ui.ack === 'string' ? ui.ack : JSON.stringify(ui.ack)}
            </motion.p>
          )}

          {/* Primary Question Heading */}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 leading-snug px-3 my-2 max-w-3xl shrink-0">
            {isProcessing ? (
              <span className="flex flex-col items-center gap-2 text-blue-600/70 my-1">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-base font-bold animate-pulse">{t('interview.processing')}</span>
              </span>
            ) : (
              typeof ui.prompt === 'string' ? ui.prompt : JSON.stringify(ui.prompt)
            )}
          </h2>
          
          {sttError && (
            <div className="bg-red-50 text-red-600 px-3.5 py-1.5 rounded-xl text-xs font-medium border border-red-200 flex items-center gap-2 my-2 shrink-0">
              <TriangleAlert className="w-4 h-4" />
              <span>{sttError}</span>
            </div>
          )}

          {/* Dynamic Option Cards with Medical Emojis */}
          {Array.isArray(ui.options) && ui.options.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-4xl my-2 px-1">
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
                    disabled={isProcessing || isRecording}
                    className={`flex items-center gap-3.5 px-5 py-3 sm:px-6 sm:py-3.5 bg-white border-2 ${visual.badgeBorder} rounded-2xl hover:shadow-card-hover active:scale-[0.97] transition-[transform,box-shadow,border-color,background-color] duration-150 text-left shadow-card border-b-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[58px] min-w-[190px] sm:min-w-[210px] flex-1 max-w-[340px]`}
                  >
                    <span className="text-2xl sm:text-3xl shrink-0 select-none leading-none">
                      {visual.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm sm:text-base font-extrabold text-slate-800 leading-snug whitespace-normal break-words">
                        {labelTranslated || label}
                      </span>
                      {hasSubtitle && (
                        <span className="block text-xs font-semibold text-slate-500 whitespace-normal break-words mt-0.5">
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
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-2 pt-2 border-t border-slate-200/80 shrink-0">
          
          {/* Quick text input form */}
          <form onSubmit={handleTextSubmit} className="flex w-full gap-2 relative">
            <div className="w-full flex items-center bg-white border border-slate-200 rounded-full pl-5 pr-14 py-2.5 shadow-card focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-card-hover transition-[border-color,box-shadow] duration-200">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isProcessing || isRecording}
                placeholder={t('interview.type_response')}
                className="w-full bg-transparent border-none text-sm sm:text-base font-semibold text-slate-800 focus:outline-none disabled:opacity-50 placeholder:text-slate-400"
              />
            </div>
            <LiquidButton 
              type="submit" 
              aria-label="Send message"
              disabled={isProcessing || isRecording || !inputText.trim()}
              className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" />
            </LiquidButton>
          </form>

          {/* Action Dock: Back, Replay, Large Mic Button, Skip */}
          <div className="flex items-center justify-between w-full gap-2">
            
            {/* Back Button */}
            <LiquidButton
              id="btn-back"
              onClick={onBack}
              className="group flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 transition-[transform,background-color,color] duration-150 active:scale-[0.97] text-xs sm:text-sm cursor-pointer shrink-0 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden xs:inline">{t('phone.back')}</span>
            </LiquidButton>

            {/* Central Voice Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <LiquidButton
                id="btn-tts-toggle"
                type="button"
                aria-label={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                onClick={() => isSpeaking ? stopTTS() : speak(ui.prompt || '', ui.language || 'hi-IN')}
                title={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                className="p-2.5 rounded-full text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/70 transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97] shrink-0 cursor-pointer shadow-card"
              >
                {isSpeaking ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
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
                  disabled={isProcessing}
                  className={`relative flex items-center justify-center gap-2 px-5 sm:px-8 py-3 rounded-full font-extrabold text-white transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97] shadow-card-hover text-xs sm:text-base ${
                    isRecording
                      ? 'bg-red-600 shadow-red-600/40 scale-102 animate-pulse'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 min-w-[150px] sm:min-w-[190px]`}
                >
                  {isRecording ? <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-bounce" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                  <span>{isRecording ? t('interview.release_to_send') : t('interview.hold_to_speak')}</span>
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
                  className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-full font-bold text-slate-600 hover:bg-slate-100 transition-colors text-xs sm:text-sm cursor-pointer"
                  title="Skip this question"
                >
                  <span className="hidden xs:inline">{t('docs.skip')}</span>
                  <SkipForward className="w-4 h-4" />
                </LiquidButton>
              ) : (
                <div className="w-10 sm:w-16" /> /* Placeholder to keep mic centered */
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

