/**
 * SwasthyaSync ΓÇö Conversational Intake Screen (v4)
 *
 * Updates:
 *  - Premium kiosk layout with glassmorphism panels
 *  - Floating chat history on the left
 *  - Refined orb positioning and typography
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Mic, TriangleAlert, SkipForward, Volume2, VolumeX, Send, ArrowLeft, Loader2, Globe } from 'lucide-react';
import { AbstractOrb } from '../components/AbstractOrb';
import type { OrbState } from '../components/AbstractOrb';
import type { UIInstruction } from '../hooks/useConversation';
import { useSarvamSTT } from '../hooks/useSarvamSTT';
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from '../translations';

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
  const { t } = useTranslations(ui.language || 'en-IN');
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-1 w-full h-full overflow-hidden bg-slate-50/50"
    >
      
      {/* Left Column: Chat History & Summary */}
      <div className="hidden lg:flex flex-col w-[380px] bg-white border-r border-slate-200 p-6 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 relative">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t('live_summary')}</h3>
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-5 rounded-2xl border border-blue-100/50 shadow-sm mb-8 text-sm text-slate-700 leading-relaxed font-medium">
          {typeof ui.section_summary === 'string' ? ui.section_summary : (ui.section_summary ? JSON.stringify(ui.section_summary) : t('waiting_info'))}
        </div>
        
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
          <span>{t('conversation')}</span>
          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px]">{t('auto_scroll')}</span>
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 custom-scrollbar">
          <AnimatePresence initial={false}>
            {Array.isArray(ui.conversation_history) && ui.conversation_history.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`p-4 rounded-2xl text-[15px] leading-relaxed max-w-[90%] shadow-sm ${
                  msg.role === 'assistant' 
                    ? 'bg-blue-50 text-blue-900 self-start border border-blue-100/50 rounded-tl-sm' 
                    : 'bg-white text-slate-700 self-end border border-slate-200 rounded-tr-sm'
                }`}
              >
                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} className="h-4" />
        </div>
        
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </div>

      {/* Right Column: Interaction */}
      <div className="flex flex-col flex-1 items-center p-4 sm:p-6 lg:p-8 text-center overflow-y-auto relative">
        
        {/* Section Label + Progress */}
        <div className="w-full max-w-3xl flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest text-blue-700 uppercase bg-blue-100/50 border border-blue-200/50 px-4 py-1.5 rounded-full">
              {typeof (ui.section_label || ui.macro_state) === 'string' ? (ui.section_label || ui.macro_state) : String(ui.section_label || ui.macro_state)}
            </span>
            {ui.language && ui.language !== 'en-IN' && (
              <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase bg-emerald-100/50 border border-emerald-200/50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                {ui.language}
              </span>
            )}
          </div>
          
          <button
            onClick={onRedflag}
            className="flex items-center gap-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors border border-red-100"
            title="Simulate Red Flag for Triage Demo"
          >
            <TriangleAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('simulate_alert')}</span>
          </button>
        </div>

        {progress && (
          <div className="w-full max-w-md mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5 tracking-wide uppercase">
              <span>{(progress as any).label || `Question ${progress.done} of ${progress.total}`}</span>
              <span className="text-blue-500">{(progress as any).percent ?? Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(progress as any).percent ?? (progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* The Central Animated Orb */}
        <div className="my-2 sm:my-3 relative">
          <AbstractOrb interactionState={effectiveOrbState} size="md" />
          
          <AnimatePresence>
            {isSpeaking && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-xs"
              >
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                <span>SPEAKING</span>
              </motion.div>
            )}
            {isRecording && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100 shadow-sm shadow-red-100"
              >
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span>LISTENING</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {ui.ack && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm sm:text-base text-teal-600 font-semibold mb-2 mt-2 max-w-lg"
          >
            {typeof ui.ack === 'string' ? ui.ack : JSON.stringify(ui.ack)}
          </motion.p>
        )}

        {/* LLM-phrased Prompt */}
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 my-3 max-w-3xl leading-snug tracking-tight px-2">
          {isProcessing ? (
            <span className="flex flex-col items-center gap-3 text-blue-500/60 my-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-lg font-bold animate-pulse">{t('processing')}</span>
            </span>
          ) : (
            typeof ui.prompt === 'string' ? ui.prompt : JSON.stringify(ui.prompt)
          )}
        </h2>

        {sttError && (
          <div className="bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-medium mb-4 border border-red-100 flex items-center gap-2">
            <TriangleAlert className="w-4 h-4" />
            {sttError}
          </div>
        )}

        {/* Dynamic Options */}
        {Array.isArray(ui.options) && ui.options.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 w-full max-w-3xl my-3 py-1">
            {ui.options.map((opt, idx) => (
              <button
                key={idx}
                id={`option-${idx}`}
                onClick={() => handleOptionTap(opt as any)}
                disabled={isProcessing || isRecording}
                className="py-2.5 px-5 sm:py-3 sm:px-6 bg-white border-2 border-slate-200/80 rounded-2xl hover:border-blue-500 hover:bg-blue-50/80 hover:text-blue-700 hover:shadow-lg hover:shadow-blue-500/10 active:scale-98 transition-all text-slate-800 font-bold text-sm sm:text-base shadow-sm border-b-4 border-b-slate-300 hover:border-b-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              >
                {opt.label || String(opt)}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="mt-auto flex flex-col w-full max-w-3xl gap-4 pt-2">
          
          {/* Text input form */}
          <form onSubmit={handleTextSubmit} className="flex w-full gap-3 relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing || isRecording}
              placeholder={t('type_response')}
              className="flex-1 rounded-full border-2 border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 transition-all placeholder:text-slate-400 placeholder:font-medium shadow-inner"
            />
            <button 
              type="submit" 
              aria-label="Send message"
              disabled={isProcessing || isRecording || !inputText.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3 pb-2 gap-2">
            <button
              id="btn-back"
              onClick={onBack}
              className="group flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-full font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 transition-all text-xs sm:text-base cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden xs:inline">{t('back')}</span>
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                id="btn-tts-toggle"
                type="button"
                aria-label={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                onClick={() => isSpeaking ? stopTTS() : speak(ui.prompt || '', ui.language || 'hi-IN')}
                title={isSpeaking ? 'Stop speaking' : 'Replay prompt'}
                className="p-2.5 sm:p-3.5 rounded-full text-slate-400 bg-white border border-slate-200 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 hover:shadow-xs transition-all shrink-0"
              >
                {isSpeaking ? <VolumeX className="w-4 h-4 sm:w-6 sm:h-6" /> : <Volume2 className="w-4 h-4 sm:w-6 sm:h-6" />}
              </button>

              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full bg-blue-500 transition-opacity duration-75"
                  style={{
                    opacity: micRingOpacity * 0.4,
                    transform: `scale(${1 + audioLevel * 0.4})`,
                    transition: 'transform 0.05s, opacity 0.05s',
                  }}
                />
                <button
                  id="btn-mic"
                  type="button"
                  onMouseDown={handleMicPress}
                  onMouseUp={handleMicRelease}
                  onTouchStart={handleMicPress}
                  onTouchEnd={handleMicRelease}
                  onTouchCancel={handleMicRelease}
                  disabled={isProcessing}
                  className={`relative flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-full font-bold text-white transition-all transform active:scale-95 shadow-md text-xs sm:text-lg ${
                    isRecording
                      ? 'bg-blue-600 shadow-blue-600/40 scale-105'
                      : 'bg-slate-900 shadow-slate-900/20 hover:bg-slate-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]`}
                >
                  {isRecording ? <Mic className="w-4 h-4 sm:w-6 sm:h-6 animate-pulse text-red-300" /> : <Mic className="w-4 h-4 sm:w-6 sm:h-6" />}
                  <span>{isRecording ? t('release_to_send') : t('hold_to_speak')}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end shrink-0">
              {ui.can_skip && (
                <button
                  id="btn-skip"
                  type="button"
                  onClick={onSkip}
                  className="flex items-center gap-1 px-3 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-slate-500 hover:bg-slate-100 transition-colors text-xs sm:text-base cursor-pointer"
                  title="Skip this question"
                >
                  <span className="hidden xs:inline">{t('skip')}</span>
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
