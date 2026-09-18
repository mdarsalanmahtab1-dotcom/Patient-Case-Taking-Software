import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { Calendar, User, Download, Star, ChevronDown, ChevronUp, Loader2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import logoPNG from '../assets/logoPNG.png';

interface Consultation {
  session_id: string;
  completed_at: string;
  department: string;
  doctor_name: string;
  chief_complaint: string;
  pdf_file_path: string | null;
  small_summary: string | null;
  critical_highlights: string[] | null;
  doctor_consultation_notes: string | null;
}

export const HistoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('portal_token');
  const [history, setHistory] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackSession, setFeedbackSession] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/portal/history`, { headers });
        setHistory(res.data);
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.clear();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  const filtered = history.filter(h => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.department?.toLowerCase().includes(q) ||
      h.doctor_name?.toLowerCase().includes(q) ||
      h.chief_complaint?.toLowerCase().includes(q)
    );
  });

  // Group by Month Year
  const grouped = filtered.reduce<Record<string, Consultation[]>>((acc, record) => {
    const d = record.completed_at ? new Date(record.completed_at) : new Date();
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const handleSubmitFeedback = async () => {
    if (!feedbackSession || rating === 0) return;
    setFeedbackSaving(true);
    try {
      await axios.post(`${API_BASE}/api/portal/feedback`, {
        session_id: feedbackSession,
        rating,
        comment: feedbackComment,
      }, { headers });
      setFeedbackSuccess(true);
      toast.success('Thank you for your feedback!');
      setTimeout(() => {
        setFeedbackSession(null);
        setFeedbackSuccess(false);
        setRating(0);
        setFeedbackComment('');
      }, 1400);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading consultation records...</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.history.title}</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">{history.length} record(s) on file</p>
        </div>
        <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
          <img src={logoPNG} alt="SwasthyaSync" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.history.searchPlaceholder}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center flex flex-col items-center shadow-xs">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center p-3.5 mb-3 shadow-xs">
            <img src={logoPNG} alt="SwasthyaSync" className="w-full h-full object-contain opacity-40 grayscale" />
          </div>
          <h3 className="text-slate-900 font-bold mb-1">{t.history.noRecords}</h3>
          <p className="text-slate-500 text-xs max-w-[240px] leading-relaxed">{t.history.noRecordsDesc}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([month, records]) => (
          <div key={month} className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">{month}</h2>
            <div className="space-y-3">
              {records.map((record) => {
                const isExpanded = expandedId === record.session_id;
                return (
                  <motion.div
                    key={record.session_id}
                    layout
                    className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden hover:border-slate-300 transition-all"
                  >
                    {/* Header (always visible) */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : record.session_id)}
                      className="w-full p-4.5 text-left flex items-start justify-between cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-600" />
                            {record.completed_at ? new Date(record.completed_at).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg capitalize">
                            {record.department}
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {record.chief_complaint || 'General Consultation'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">Dr. {record.doctor_name || 'Assigned Doctor'}</span>
                        </p>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-1 group-hover:bg-blue-50 transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        )}
                      </div>
                    </button>

                    {/* Smooth Spring Accordion Content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="accordion-details"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-4.5 pb-4.5 border-t border-slate-100 pt-3.5 space-y-3">
                            {record.small_summary && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-0.5">{t.history.summary}</p>
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">{record.small_summary}</p>
                              </div>
                            )}

                            {record.critical_highlights && record.critical_highlights.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1.5 ml-0.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{t.history.criticalHighlights}</span>
                                </p>
                                <ul className="space-y-1.5">
                                  {record.critical_highlights.map((h, i) => (
                                    <li key={i} className="text-xs text-red-700 bg-red-50/90 px-3 py-2 rounded-xl border border-red-100/80 font-medium">
                                      ⚠ {typeof h === 'string' ? h : JSON.stringify(h)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {record.doctor_consultation_notes && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-0.5">{t.history.doctorsNotes}</p>
                                <p className="text-xs sm:text-sm text-slate-700 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 leading-relaxed">{record.doctor_consultation_notes}</p>
                              </div>
                            )}

                            <div className="flex gap-2.5 pt-1.5">
                              {record.pdf_file_path && (
                                <motion.button
                                  whileTap={{ scale: 0.96 }}
                                  whileHover={{ translateY: -1 }}
                                  onClick={() => window.open(record.pdf_file_path!, '_blank')}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 border border-blue-200/90 rounded-2xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all shadow-xs"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {t.history.downloadPdf}
                                </motion.button>
                              )}
                              <motion.button
                                whileTap={{ scale: 0.96 }}
                                whileHover={{ translateY: -1 }}
                                onClick={() => { setFeedbackSession(record.session_id); setRating(0); setFeedbackComment(''); }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 border border-amber-200/90 rounded-2xl text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all shadow-xs"
                              >
                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                {t.history.giveFeedback}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Feedback Modal / Sheet */}
      <AnimatePresence>
        {feedbackSession && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFeedbackSession(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm -z-10"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-[0_20px_50px_rgba(15,23,42,0.25)] border border-slate-100"
              onClick={e => e.stopPropagation()}
            >
              {feedbackSuccess ? (
                <div className="text-center py-6 space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  </motion.div>
                  <p className="text-sm font-bold text-slate-900">{t.history.feedbackSuccess}</p>
                </div>
              ) : (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">{t.history.feedbackTitle}</h3>
                  <p className="text-xs font-medium text-slate-500 mb-4">{t.history.ratingPrompt}</p>

                  <div className="flex gap-2.5 justify-center mb-4.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <motion.button
                        key={s}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setRating(s)}
                        className="p-1"
                        aria-label={`${s} star`}
                      >
                        <Star className={`w-8 h-8 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} transition-colors`} />
                      </motion.button>
                    ))}
                  </div>

                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder={t.history.commentPlaceholder}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm resize-none h-20 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-xs"
                  />

                  <div className="flex gap-2.5 mt-3.5">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setFeedbackSession(null)}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs sm:text-sm hover:bg-slate-200 transition-colors"
                    >
                      {t.history.cancel}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={handleSubmitFeedback}
                      disabled={rating === 0 || feedbackSaving}
                      className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs sm:text-sm disabled:opacity-50 active:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                    >
                      {feedbackSaving ? t.history.submitting : t.history.submitFeedback}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

