import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';
import { ChevronLeft, Send, Pill, Clock, Stethoscope, RotateCcw, HelpCircle, PhoneCall } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import logoPNG from '../assets/logoPNG.png';

interface SourceMeta {
  type: string;
  id?: string;
  label?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: SourceMeta[];
  emergency?: boolean;
  needs_clinician?: boolean;
  suggested_followups?: string[];
}

function cleanAiResponse(raw: any): { text: string; parsedData?: any } {
  if (!raw) return { text: '' };
  let str = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);

  // Strip markdown code fences if present
  if (str.startsWith('```json')) {
    str = str.substring(7);
  } else if (str.startsWith('```')) {
    str = str.substring(3);
  }
  if (str.endsWith('```')) {
    str = str.substring(0, str.length - 3);
  }
  str = str.trim();

  // If it's a JSON string, try to parse
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        const innerText = parsed.response || parsed.reply || '';
        if (innerText) {
          const nested = cleanAiResponse(innerText);
          return { text: nested.text || innerText, parsedData: parsed };
        }
        return { text: str, parsedData: parsed };
      }
    } catch {
      // Ignore parse failure
    }
  }

  // Regex fallback: check if there is an embedded JSON inside the string: { "response": "..." }
  const jsonMatch = str.match(/\{[\s\S]*"response"\s*:\s*"([\s\S]*?)"[\s\S]*\}/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const unescaped = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      return { text: unescaped };
    } catch {}
  }

  return { text: str };
}

export const ChatScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('portal_token');
  const phone = localStorage.getItem('portal_phone') || 'current';
  const CHAT_STORAGE_KEY = `portal_chat_${phone}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: Message) => {
            if (m.sender === 'ai' && m.text && (m.text.includes('```json') || m.text.trim().startsWith('{'))) {
              return { ...m, text: cleanAiResponse(m.text).text || m.text };
            }
            return m;
          });
        }
      }
    } catch {}
    return [{ id: '1', sender: 'ai', text: t.chat.welcomeMessage }];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordAvailable, setRecordAvailable] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(() => messages.length <= 1);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const suggestions = [
    { icon: <Pill className="w-3.5 h-3.5 text-blue-600" />, text: t.chat.sugMedications },
    { icon: <Clock className="w-3.5 h-3.5 text-emerald-600" />, text: t.chat.sugNextDose },
    { icon: <Stethoscope className="w-3.5 h-3.5 text-purple-600" />, text: t.chat.sugDiagnosis },
    { icon: <HelpCircle className="w-3.5 h-3.5 text-cyan-600" />, text: (t.chat as any).sugKiosk || 'What does the SwasthyaSync kiosk do?' },
  ];

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    // Check dynamic clinical record status
    axios.get(`${API_BASE}/api/portal/chat/status`, { headers })
      .then(res => {
        setRecordAvailable(Boolean(res.data.record_available));
      })
      .catch(() => {
        setRecordAvailable(false);
      });
  }, [token, navigate]);

  // Persist messages across page changes & reloads for this login session
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to save chat history:', err);
    }
  }, [messages, CHAT_STORAGE_KEY]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleClearChat = () => {
    const fresh: Message[] = [{ id: Date.now().toString(), sender: 'ai', text: t.chat.welcomeMessage }];
    setMessages(fresh);
    setShowSuggestions(true);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    setShowSuggestions(false);
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const recentHistory = nextMessages
        .filter(m => m.id !== '1' || m.sender !== 'ai')
        .slice(-6)
        .map(m => ({ sender: m.sender, text: m.text }));

      const response = await axios.post(`${API_BASE}/api/portal/chat`,
        { user_message: text, history: recentHistory },
        { headers }
      );

      let data = response.data || {};
      let rawReply = data.reply || data.response || 'I am ready to help with your health questions.';
      const { text: cleanReply, parsedData } = cleanAiResponse(rawReply);
      if (parsedData) {
        data = { ...data, ...parsedData };
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: cleanReply || 'I am ready to help with your health questions.',
        sources: data.sources || [],
        emergency: Boolean(data.emergency),
        needs_clinician: Boolean(data.needs_clinician),
        suggested_followups: data.suggested_followups || []
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'I apologize, but I am currently having trouble connecting to the medical server. Please check your connection and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] max-w-md mx-auto bg-slate-50 relative overflow-hidden">

      {/* Glassmorphic Header */}
      <header className="bg-white/85 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-slate-200/70 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 rounded-full transition-colors cursor-pointer"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
              <img src={logoPNG} alt="SwasthyaSync" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5">
                SwasthyaSync AI
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-blue-50 text-blue-700 rounded border border-blue-200/60 uppercase">Assistant</span>
              </h1>
              {recordAvailable === true ? (
                <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {(t.chat as any).statusConnected || 'Online • Record Connected'}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {(t.chat as any).statusGeneral || 'Online • Health & Hospital Assistant'}
                </p>
              )}
            </div>
          </div>
        </div>

        {messages.length > 1 && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleClearChat}
            title="Reset Chat"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-colors text-xs font-bold border border-transparent hover:border-red-100 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </motion.button>
        )}
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 touch-pan-y">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0 mb-0.5 shadow-2xs">
                  <img src={logoPNG} alt="AI" className="w-full h-full object-contain" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-3xl px-4.5 py-3 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-tr-md shadow-blue-600/15'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-md shadow-2xs'
              }`}>
                <div>{msg.sender === 'ai' ? cleanAiResponse(msg.text).text : msg.text}</div>

                {/* Emergency Urgent Callout Banner */}
                {msg.emergency && (
                  <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-red-800">Immediate Ambulance: 108</span>
                    <a
                      href="tel:108"
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-red-700 transition-colors"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Call 108</span>
                    </a>
                  </div>
                )}

                {/* Verified Source Badges */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
                    {msg.sources.map((src, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center text-[9px] font-bold text-slate-600 bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 rounded-md"
                      >
                        {src.label || src.type}
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Follow-up Quick Chips */}
                {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                    {msg.suggested_followups.map((fText, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => sendMessage(fText)}
                        className="text-[10px] font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 px-2.5 py-1 rounded-full text-left transition-colors cursor-pointer"
                      >
                        {fText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggestion Chips */}
        {showSuggestions && messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex flex-col gap-2 pt-2"
          >
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.97 }}
                whileHover={{ translateY: -1 }}
                onClick={() => sendMessage(s.text)}
                className="flex items-center gap-2.5 px-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left shadow-xs cursor-pointer"
              >
                <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
                  {s.icon}
                </div>
                <span>{s.text}</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Animated Wave Typing Indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2 justify-start"
          >
            <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0 mb-0.5 shadow-2xs">
              <img src={logoPNG} alt="AI" className="w-full h-full object-contain" />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-3xl rounded-tl-md px-4 py-3 shadow-xs flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-500 font-semibold ml-1">{t.chat.assistantTyping}</span>
            </div>
          </motion.div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-3.5 bg-white/90 backdrop-blur-xl border-t border-slate-200/70 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat.inputPlaceholder}
            className="w-full bg-slate-100 border border-slate-200/60 rounded-full py-3 pl-4.5 pr-12 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
          {t.chat.disclaimer}
        </p>
      </div>
    </div>
  );
};
