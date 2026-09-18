import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ArrowRight, User, LogOut, Coffee, CheckCircle, Settings, X, History, FileText, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBaseUrl } from '../config';

export const DoctorQueue: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [doctorAuth, setDoctorAuth] = useState<any>(() => {
    const stored = localStorage.getItem('swasthya_doctor_auth');
    return stored ? JSON.parse(stored) : null;
  });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Feature state: history, summary, expanded red-flag cards
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set());

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (doctorAuth) {
      const fetchQ = () => {
        const docIdParam = doctorAuth?.doctor_id ? `?doctor_id=${doctorAuth.doctor_id}` : '';
        fetch(`${getApiBaseUrl()}/api/triage/queue${docIdParam}`)
          .then(res => res.json())
          .then(data => {
            const q = data.queue || data || [];
            // Show all active patients waiting or in consultation for this doctor
            setQueue(q.filter((p: any) => {
              const matchesDoctor = !p.doctor_id || String(p.doctor_id) === String(doctorAuth.doctor_id);
              const isActive = p.session_status !== 'COMPLETED' && p.session_status !== 'ARCHIVED';
              return matchesDoctor && isActive;
            }));
          })
          .catch(console.error);
      };
      fetchQ();
      const interval = setInterval(fetchQ, 3000);
      return () => clearInterval(interval);
    }
  }, [doctorAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('swasthya_doctor_auth', JSON.stringify(data));
        setDoctorAuth(data);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Invalid credentials');
      }
    } catch (e) {
      setLoginError('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('swasthya_doctor_auth');
    setDoctorAuth(null);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!doctorAuth) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = { ...doctorAuth, current_status: newStatus };
        localStorage.setItem('swasthya_doctor_auth', JSON.stringify(updated));
        setDoctorAuth(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openSettings = async () => {
    setShowSettingsModal(true);
    if (!doctorAuth) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/instructions`);
      if (res.ok) {
        const data = await res.json();
        setCustomInstructions(data.custom_instructions || '');
      }
    } catch (e) {
      console.error("Failed to load instructions", e);
    }
  };

  const saveSettings = async () => {
    if (!doctorAuth) return;
    setIsSavingSettings(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/doctor/${doctorAuth.doctor_id}/instructions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_instructions: customInstructions })
      });
      setShowSettingsModal(false);
    } catch (e) {
      console.error("Failed to save instructions", e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ── Patient History ──
  const openHistory = async (patientId: string) => {
    setHistoryPatientId(patientId);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/patient/${patientId}/summaries`);
      const data = await res.json();
      setHistoryData(data.summaries || []);
    } catch { setHistoryData([]); }
  };

  // ── Clinical Summary ──
  const openSummary = async (sessionId: string) => {
    setSummarySessionId(sessionId);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctor/encounter/${sessionId}`);
      const data = await res.json();
      setSummaryData(data);
    } catch { setSummaryData(null); }
  };

  // ── Toggle red-flag expansion ──
  const toggleFlag = (sessionId: string) => {
    setExpandedFlags(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  };

  const parseReason = (reason: string) => {
    if (!reason) return { ruleId: 'UNKNOWN', description: 'No reason recorded' };
    const parts = reason.split(': ');
    if (parts.length >= 2) return { ruleId: parts[0].trim(), description: parts.slice(1).join(': ').trim() };
    return { ruleId: 'FLAG', description: reason };
  };


  if (!doctorAuth) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-8 font-sans bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-slate-200 rounded-3xl p-8 w-full max-w-md shadow-elevated"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 border border-blue-100 mb-4 shadow-sm">
              <Stethoscope className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Physician Portal</h1>
            <p className="text-slate-500 mt-2 font-medium">Sign in to access your patient queue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</p>}
            <LiquidButton type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-md mt-6">
              Access Workspace
            </LiquidButton>
            <LiquidButton type="button" onClick={() => navigate('/')} className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl transition shadow-sm">
              Return to Home
            </LiquidButton>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full font-sans p-4 sm:p-8 flex flex-col overflow-hidden bg-slate-50">
      <div className="max-w-5xl mx-auto flex-1 flex flex-col overflow-hidden">
        <header className="flex-none flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 gap-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white shadow-sm border border-slate-200 rounded-xl">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Dr. {doctorAuth.full_name}</h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {queue.length} Active {queue.length === 1 ? 'Patient' : 'Patients'}
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Room {doctorAuth.room_number} • {doctorAuth.current_status}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={openSettings}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Preferences</span>
            </button>
            <button
              onClick={() => handleStatusChange('Available')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                doctorAuth.current_status === 'Available' 
                  ? 'bg-blue-50 text-blue-700 border-2 border-blue-200' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Available
            </button>
            <button
              onClick={() => handleStatusChange('On Break')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                doctorAuth.current_status === 'On Break' 
                  ? 'bg-amber-50 text-amber-700 border-2 border-amber-200' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Coffee className="w-4 h-4 mr-1.5" /> Break
            </button>
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth space-y-4 pb-4">
          {queue.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-200 rounded-2xl text-slate-500 shadow-card font-medium">
              No patients currently waiting in your queue.
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {queue.map((patient) => (
                <motion.div 
                  key={patient.session_id} 
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between transition-[box-shadow,transform] duration-200 hover:shadow-card-hover hover:-translate-y-[1px] gap-4 ${
                    patient.priority_flag ? 'bg-red-50/50 border-red-200 shadow-card' : 'bg-white border-slate-200 shadow-card'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-2xl ${patient.priority_flag ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900">{patient.full_name}</h2>
                        <span className="text-sm font-medium text-slate-500">Age: {patient.age} • {patient.gender}</span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          patient.session_status === 'WAITING' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {patient.session_status === 'WAITING' ? '⏳ Waiting' : '🩺 In Consultation'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 font-medium">Token: <span className="text-blue-600 font-bold">{patient.token_id || patient.token_number}</span> | Complaint: {patient.chief_complaint || 'Pending AI Intake'}</p>
                      {patient.nurse_triage_notes && (
                        <p className="text-sm text-amber-700 mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 font-medium">
                          <span className="font-bold">Triage Note:</span> {patient.nurse_triage_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {patient.priority_flag && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => toggleFlag(patient.session_id)}
                          className="flex items-center text-xs font-extrabold text-red-600 bg-red-100 px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-200 transition-colors cursor-pointer active:scale-[0.97]"
                        >
                          <ShieldAlert className="w-4 h-4 mr-1" /> HIGH PRIORITY
                          {expandedFlags.has(patient.session_id) ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                        </button>
                      </div>
                    )}
                    <LiquidButton
                      onClick={() => openSummary(patient.session_id)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center transition shadow-card whitespace-nowrap text-xs"
                    >
                      <FileText className="w-4 h-4 mr-1" /> Summary
                    </LiquidButton>
                    <LiquidButton
                      onClick={() => openHistory(patient.patient_id)}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl flex items-center transition shadow-card whitespace-nowrap text-xs"
                    >
                      <History className="w-4 h-4 mr-1" /> History
                    </LiquidButton>
                    <LiquidButton
                      onClick={() => navigate(`/doctor/encounter/${patient.session_id}`)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center transition shadow-card whitespace-nowrap text-xs"
                    >
                      Open <ArrowRight className="w-4 h-4 ml-2" />
                    </LiquidButton>
                  </div>

                  {/* Expanded Red-Flag Reasoning with smooth accordion */}
                  <AnimatePresence>
                    {patient.priority_flag && expandedFlags.has(patient.session_id) && patient.priority_reason && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden w-full"
                      >
                        <div className="mt-3 p-4 bg-red-50 rounded-xl border border-red-200 w-full">
                          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Clinical Reasoning
                          </p>
                          {patient.priority_reason.split('; ').map((reason: string, i: number) => {
                            const { ruleId, description } = parseReason(reason);
                            const isDoc = ['document', 'lab', 'ocr', 'troponin', 'creatinine'].some(kw => reason.toLowerCase().includes(kw));
                            return (
                              <div key={i} className="flex items-start gap-2 mb-1.5">
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isDoc ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                  {isDoc ? 'DOC' : 'CONV'}
                                </span>
                                <span className="text-xs font-bold text-slate-700">{ruleId}:</span>
                                <span className="text-xs text-slate-600">{description}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <LogoutDialog 
        isOpen={showLogoutDialog} 
        onClose={() => setShowLogoutDialog(false)} 
        onConfirm={() => {
          setShowLogoutDialog(false);
          handleLogout();
          navigate('/');
        }} 
      />

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-elevated overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Physician Preferences</h2>
                  <p className="text-sm text-slate-500 font-medium">Set custom instructions for the AI Kiosk</p>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Custom Intake Prompt (Additive)</label>
                <textarea
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  placeholder="Example: I am an orthopedic surgeon. Always ask about past sports injuries and exact pain duration."
                  className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none"
                />
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  These instructions will be injected into the AI interviewer when patients select you.
                </p>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  disabled={isSavingSettings}
                  className="px-4 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm disabled:opacity-50"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Patient History Modal ── */}
      <AnimatePresence>
        {historyPatientId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-elevated overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" /> Patient History
                </h2>
                <button onClick={() => setHistoryPatientId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {historyData.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 font-medium">No previous visits found</p>
                ) : (
                  historyData.map((visit: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          {visit.created_at ? new Date(visit.created_at).toLocaleDateString('en-IN') : 'Unknown date'}
                        </span>
                        {visit.pdf_path && (
                          <a
                            href={`${getApiBaseUrl()}/api/pdf/${visit.session_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{visit.small_summary || 'No summary available'}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Clinical Summary Modal ── */}
      <AnimatePresence>
        {summarySessionId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-elevated overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" /> Clinical Summary
                </h2>
                <button onClick={() => { setSummarySessionId(null); setSummaryData(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {!summaryData ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Patient Header */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className="p-3 bg-blue-100 rounded-full"><User className="w-6 h-6 text-blue-600" /></div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{summaryData.full_name || 'Unknown'}</h3>
                        <p className="text-sm text-slate-500 font-medium">{summaryData.age ? `${summaryData.age}y` : ''} {summaryData.gender || ''} • Token: {summaryData.token_id}</p>
                      </div>
                      {summaryData.priority_flag && (
                        <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full border border-red-200">
                          <ShieldAlert className="w-3 h-3 inline mr-1" /> HIGH PRIORITY
                        </span>
                      )}
                    </div>

                    {/* Chief Complaint */}
                    {summaryData.chief_complaint && (
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Chief Complaint</p>
                        <p className="text-base font-semibold text-blue-900">{summaryData.chief_complaint}</p>
                      </div>
                    )}

                    {/* AI Summary */}
                    {summaryData.small_summary && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI Clinical Summary</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl">{summaryData.small_summary}</p>
                      </div>
                    )}

                    {/* Critical Highlights */}
                    {summaryData.critical_highlights && summaryData.critical_highlights.length > 0 && (
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-200">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Critical Highlights
                        </p>
                        <ul className="space-y-1">
                          {summaryData.critical_highlights.map((h: string, i: number) => (
                            <li key={i} className="text-sm text-red-800 font-medium">• {typeof h === 'string' ? h : JSON.stringify(h)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Filled State Details */}
                    {summaryData.filled_state && typeof summaryData.filled_state === 'object' && Object.keys(summaryData.filled_state.filled_state || {}).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clinical Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(summaryData.filled_state.filled_state || {}).map(([key, val]: [string, any]) => (
                            <div key={key} className="bg-slate-50 p-3 rounded-2xl">
                              <p className="text-xs font-bold text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
                              <p className="text-sm font-medium text-slate-900">{typeof val === 'object' ? (val?.value || JSON.stringify(val)) : String(val)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contradictions */}
                    {summaryData.contradictions_found && summaryData.contradictions_found.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Contradictions Found</p>
                        <ul className="space-y-1">
                          {summaryData.contradictions_found.map((c: any, i: number) => (
                            <li key={i} className="text-sm text-amber-800 font-medium">• {typeof c === 'string' ? c : JSON.stringify(c)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
