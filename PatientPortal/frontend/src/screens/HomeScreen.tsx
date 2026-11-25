import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';
import { FileDown, Clock, MapPin, User, MessageCircle, Loader2, Building2, BookOpen, X, ChevronRight } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { MEDICAL_GLOSSARY } from '../data/medicalGlossary';
import logoPNG from '../assets/logoPNG.png';

interface QueueSession {
  token_id: string;
  token_number: number;
  department: string;
  session_status: string;
  doctor_name: string;
  room_number: string;
  queue_position: number;
  estimated_wait_minutes: number;
}

interface Consultation {
  session_id: string;
  completed_at: string;
  department: string;
  doctor_name: string;
  chief_complaint: string;
}

interface HomeScreenProps {
  onNavigateToTab?: (tab: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToTab }) => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const token = localStorage.getItem('portal_token');
  const phone = localStorage.getItem('portal_phone') || '';
  const [queue, setQueue] = useState<QueueSession[]>([]);
  const [latestVisit, setLatestVisit] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossaryFilter, setGlossaryFilter] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.home.goodMorning;
    if (h < 17) return t.home.goodAfternoon;
    return t.home.goodEvening;
  };

  const maskPhone = (p: string) => 'XXXXXX' + p.slice(-4);

  const fetchData = async () => {
    try {
      const [qRes, hRes] = await Promise.all([
        axios.get(`${API_BASE}/api/portal/queue-status`, { headers }).catch(() => ({ data: { active_sessions: [] } })),
        axios.get(`${API_BASE}/api/portal/history`, { headers }).catch(() => ({ data: [] })),
      ]);
      setQueue(qRes.data.active_sessions || []);
      if (hRes.data.length > 0) {
        setLatestVisit(hRes.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading your health overview...</p>
      </div>
    );
  }

  const glossaryList = Object.values(MEDICAL_GLOSSARY).filter(g =>
    g.term.toLowerCase().includes(glossaryFilter.toLowerCase()) ||
    g.meaning[language]?.toLowerCase().includes(glossaryFilter.toLowerCase())
  );

  return (
    <div className="p-5 space-y-5 max-w-md mx-auto">
      {/* SwasthyaSync Top Brand Bar */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
            <img src={logoPNG} alt="SwasthyaSync" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-slate-900">
                Swasthya<span className="text-blue-600">Sync</span>
              </span>
              <span className="text-xs font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
                Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold tracking-tight">AI OPD & Health Records</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ translateY: -1 }}
            onClick={() => setShowGlossary(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-700 rounded-full text-xs font-bold border border-blue-200/80 shadow-2xs hover:bg-blue-50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Glossary</span>
          </motion.button>
        </div>
      </div>

      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{getGreeting()}</h1>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">{maskPhone(phone)}</p>
        </div>
      </div>

      {/* Live Queue Hero Card */}
      {queue.length > 0 ? (
        queue.map((q) => (
          <motion.div
            key={q.token_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-5 shadow-card border-2 border-blue-600"
            aria-label="Your visit today"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-600">{t.home.queueTitle}</p>
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold ${
                q.session_status === 'IN_PROGRESS' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${q.session_status === 'IN_PROGRESS' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} aria-hidden="true" />
                {q.session_status === 'IN_PROGRESS' ? 'With the doctor' : 'Waiting'}
              </span>
            </div>

            <div className="mt-3 flex items-end gap-3">
              <p className="text-6xl font-bold leading-none tracking-tight text-blue-700 tabular-nums">{q.queue_position}</p>
              <p className="pb-1 text-base font-medium text-slate-700">
                {q.session_status === 'IN_PROGRESS' ? 'You are being seen now' : 'Your place in the queue'}
              </p>
            </div>

            {q.session_status === 'WAITING' && q.estimated_wait_minutes > 0 && (
              <p className="mt-3 flex items-center gap-2 text-base text-slate-700">
                <Clock className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                {t.home.estimatedWait}: <strong className="font-semibold text-slate-900 tabular-nums">about {q.estimated_wait_minutes} {t.home.minutes}</strong>
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-slate-500"><User className="h-4 w-4" aria-hidden="true" /> Doctor</dt>
                <dd className="mt-0.5 truncate font-semibold text-slate-900">{q.doctor_name || 'Assigned doctor'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-slate-500"><MapPin className="h-4 w-4" aria-hidden="true" /> {t.home.room}</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{q.room_number || 'To be assigned'}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="flex items-center gap-1.5 text-slate-500"><Building2 className="h-4 w-4" aria-hidden="true" /> Department</dt>
                <dd className="mt-0.5 truncate font-semibold capitalize text-slate-900">{q.department}</dd>
              </div>
            </dl>
          </motion.div>
        ))
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-200 text-center">
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Clock className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-bold text-slate-800">{t.home.noActiveQueue}</p>
          <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto leading-relaxed">{t.home.noActiveQueueDesc}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t.home.quickActions}</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ translateY: -1 }}
            onClick={() => navigate('/chat')}
            className="flex flex-col items-center justify-center p-3.5 bg-blue-600 text-white rounded-2xl shadow-card hover:bg-blue-700 active:bg-blue-800 transition-colors text-center"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-1.5">
              <MessageCircle className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold leading-tight">{t.home.askAi}</span>
            <span className="text-xs text-blue-100 mt-0.5 leading-tight">{t.home.askAiDesc}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ translateY: -1 }}
            onClick={async () => {
              try {
                const res = await axios.get(`${API_BASE}/api/portal/export`, { headers });
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `health_vault_${phone}.json`; a.click();
              } catch {}
            }}
            className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200/90 text-slate-700 rounded-2xl hover:border-slate-300 hover:bg-slate-50/50 shadow-xs transition-all text-center group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100/60 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <FileDown className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-bold leading-tight">{t.home.healthVault}</span>
            <span className="text-xs text-slate-500 mt-0.5 leading-tight">{t.home.healthVaultDesc}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ translateY: -1 }}
            onClick={() => onNavigateToTab ? onNavigateToTab('hospital') : null}
            className="flex flex-col items-center justify-center p-3.5 bg-white border border-slate-200/90 text-slate-700 rounded-2xl hover:border-slate-300 hover:bg-slate-50/50 shadow-xs transition-all text-center group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100/60 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-bold leading-tight">{t.home.hospitalGuide}</span>
            <span className="text-xs text-slate-500 mt-0.5 leading-tight">{t.home.hospitalGuideDesc}</span>
          </motion.button>
        </div>
      </div>

      {/* Latest Consultation */}
      {latestVisit && (
        <div>
          <div className="flex items-center justify-between mb-3 ml-1">
            <h2 className="text-xs font-bold text-slate-500">{t.home.recentConsultation}</h2>
            <button
              onClick={() => onNavigateToTab ? onNavigateToTab('history') : null}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
            >
              <span>{t.home.viewAllHistory}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigateToTab ? onNavigateToTab('history') : null}
            className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 hover:border-blue-200 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/60">
                {latestVisit.completed_at ? new Date(latestVisit.completed_at).toLocaleDateString() : 'Date N/A'}
              </span>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg capitalize">
                {latestVisit.department}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 mt-2 line-clamp-1">
              {latestVisit.chief_complaint || 'General Consultation'}
            </p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <User className="w-3 h-3 text-slate-500" />
              <span>Dr. {latestVisit.doctor_name || 'Assigned Doctor'}</span>
            </p>
          </motion.div>
        </div>
      )}

      {/* Medical Glossary Modal / Sheet */}
      <AnimatePresence>
        {showGlossary && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGlossary(false)}
              className="fixed inset-0 bg-slate-900/40 -z-10"
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white w-full max-w-md max-h-[82vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.25)] border border-slate-100"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Medical Term Glossary</h3>
                </div>
                <button
                  onClick={() => setShowGlossary(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <input
                  type="text"
                  value={glossaryFilter}
                  onChange={(e) => setGlossaryFilter(e.target.value)}
                  placeholder="Search medical terms (e.g., BP, Fever)..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-xs transition-all"
                  autoFocus
                />
              </div>
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {glossaryList.map((g, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100/90 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">{g.term}</span>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100/60 px-2 py-0.5 rounded-full">{g.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {g.meaning[language] || g.meaning.en}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

