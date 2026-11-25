import { LogoutDialog } from '../components/LogoutDialog';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ArrowRight, LogOut, Coffee, CheckCircle, Settings, X, History, FileText, ChevronDown, ChevronUp, ShieldAlert, Inbox } from 'lucide-react';
import { StaffSignIn } from '../components/StaffSignIn';
import { EmptyState, Skeleton } from '../components/ui/states';
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
  const [panelTab, setPanelTab] = useState<'summary' | 'history'>('summary');

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

  const handleLogin = async (username: string, password: string) => {
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
        setLoginError(err.detail || "That username and password don't match. Check them and try again.");
      }
    } catch (e) {
      setLoginError("Can't reach the hospital server. Check the connection and try again.");
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
      <StaffSignIn
        title="Doctor sign in"
        subtitle="Open your patient queue"
        icon={<Stethoscope className="h-6 w-6" aria-hidden="true" />}
        accent="blue"
        idLabel="Username"
        error={loginError}
        onSubmit={handleLogin}
        onBack={() => navigate('/')}
      />
    );
  }

  const drName = (name: string) => (/^(dr\.?|vaidya)\s/i.test(name || '') ? name : `Dr. ${name}`);
  const selected = queue.find(p => p.session_id === summarySessionId) || null;
  const closePanel = () => { setSummarySessionId(null); setSummaryData(null); setHistoryPatientId(null); setHistoryData([]); };
  const selectPatient = (p: any) => {
    setPanelTab('summary');
    setHistoryPatientId(null);
    setHistoryData([]);
    openSummary(p.session_id);
  };
  const showHistory = (p: any) => {
    setPanelTab('history');
    if (summarySessionId !== p.session_id) { setSummaryData(null); openSummary(p.session_id); }
    openHistory(p.patient_id);
  };
  const isAvailable = doctorAuth.current_status === 'Available';

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{drName(doctorAuth.full_name)}</h1>
              <p className="text-sm text-slate-500">
                {doctorAuth.room_number ? (/^room/i.test(String(doctorAuth.room_number)) ? doctorAuth.room_number : `Room ${doctorAuth.room_number}`) : 'No room set'}
                {' · '}<span className="tabular-nums">{queue.length}</span> {queue.length === 1 ? 'patient' : 'patients'} waiting
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Your status" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
              <button
                type="button"
                role="radio"
                aria-checked={isAvailable}
                onClick={() => handleStatusChange('Available')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold cursor-pointer ${isAvailable ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" /> Available
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!isAvailable}
                onClick={() => handleStatusChange('On Break')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold cursor-pointer ${!isAvailable ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <Coffee className="h-4 w-4" aria-hidden="true" /> On break
              </button>
            </div>
            <button
              type="button"
              onClick={openSettings}
              className="tap inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Preferences
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutDialog(true)}
              className="tap inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-5 overflow-hidden px-4 py-4 sm:px-6">
        {/* ── Queue ─────────────────────────────────────────────── */}
        <section aria-label="Patient queue" className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:max-w-[46%]">
          {queue.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
              <EmptyState
                icon={<Inbox />}
                title="No patients waiting"
                description="Patients who choose you at the kiosk appear here once their intake is done."
              />
            </div>
          ) : (
            <ul className="space-y-3 pb-4">
              <AnimatePresence initial={false}>
                {queue.map((patient) => {
                  const isSel = patient.session_id === summarySessionId;
                  return (
                    <motion.li
                      key={patient.session_id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`rounded-xl border-2 border-l-[6px] bg-white shadow-card ${
                        isSel ? 'border-blue-600' : 'border-slate-200'
                      } ${patient.priority_flag ? '!border-l-red-600' : patient.session_status === 'WAITING' ? '!border-l-amber-500' : '!border-l-blue-600'}`}
                    >
                      <button
                        type="button"
                        onClick={() => selectPatient(patient)}
                        aria-pressed={isSel}
                        className="w-full p-4 text-left cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-base font-bold text-slate-900">{patient.full_name}</span>
                              <span className="text-sm text-slate-500">{[patient.age && `${patient.age} y`, patient.gender].filter(Boolean).join(' · ')}</span>
                            </p>
                            <p className="mt-0.5 text-sm text-slate-700">{patient.chief_complaint || 'Intake still in progress'}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">Token</p>
                            <p className="text-lg font-bold leading-tight tabular-nums text-slate-900">{patient.token_id || patient.token_number}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {patient.priority_flag ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> High priority
                            </span>
                          ) : null}
                          <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${patient.session_status === 'WAITING' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                            {patient.session_status === 'WAITING' ? 'Waiting' : 'In consultation'}
                          </span>
                        </div>
                        {patient.nurse_triage_notes && (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                            <span className="font-semibold">Nurse note:</span> {patient.nurse_triage_notes}
                          </p>
                        )}
                      </button>

                      {patient.priority_flag && patient.priority_reason && (
                        <div className="border-t border-slate-100 px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => toggleFlag(patient.session_id)}
                            aria-expanded={expandedFlags.has(patient.session_id)}
                            className="tap inline-flex items-center gap-1 text-sm font-semibold text-red-700 cursor-pointer"
                          >
                            Why flagged
                            {expandedFlags.has(patient.session_id) ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                          </button>
                          {expandedFlags.has(patient.session_id) && (
                            <ul className="mt-1 space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
                              {patient.priority_reason.split('; ').map((reason: string, i: number) => {
                                const { ruleId, description } = parseReason(reason);
                                const isDoc = ['document', 'lab', 'ocr', 'troponin', 'creatinine'].some(kw => reason.toLowerCase().includes(kw));
                                return (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${isDoc ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                      {isDoc ? 'Report' : 'Interview'}
                                    </span>
                                    <span className="text-slate-700"><span className="font-semibold">{ruleId}:</span> {description}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 border-t border-slate-100 p-3">
                        <button
                          type="button"
                          onClick={() => showHistory(patient)}
                          className="tap flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <History className="h-4 w-4" aria-hidden="true" /> Past visits
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/doctor/encounter/${patient.session_id}`)}
                          className="tap flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
                        >
                          Start consult <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* ── Selected patient panel (side panel on desktop, full sheet on small screens) ── */}
        <aside
          aria-label="Selected patient"
          className={`${summarySessionId ? 'fixed inset-0 z-40 flex' : 'hidden'} flex-col bg-white lg:static lg:z-auto lg:flex lg:flex-1 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-card overflow-hidden`}
        >
          {!summarySessionId ? (
            <EmptyState
              className="h-full"
              icon={<FileText />}
              title="Select a patient"
              description="Their intake summary, red flags and past visits open here, so you can read them without leaving the queue."
            />
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{summaryData?.full_name || selected?.full_name || 'Patient'}</p>
                  <p className="text-sm text-slate-500">
                    {[summaryData?.age && `${summaryData.age} y`, summaryData?.gender, (summaryData?.token_id || selected?.token_id) && `Token ${summaryData?.token_id || selected?.token_id}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" onClick={closePanel} aria-label="Close patient panel" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div role="tablist" aria-label="Patient details" className="flex shrink-0 gap-1 border-b border-slate-200 px-3">
                {(['summary', 'history'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={panelTab === tab}
                    onClick={() => (tab === 'history' && selected ? showHistory(selected) : setPanelTab(tab))}
                    className={`tap -mb-px border-b-2 px-3 text-sm font-semibold cursor-pointer ${panelTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    {tab === 'summary' ? 'Intake summary' : 'Past visits'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {panelTab === 'summary' ? (
                  !summaryData ? (
                    <div className="space-y-3" aria-busy="true">
                      <Skeleton className="h-16 rounded-xl" />
                      <Skeleton className="h-24 rounded-xl" />
                      <Skeleton className="h-20 rounded-xl" />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {summaryData.critical_highlights && summaryData.critical_highlights.length > 0 && (
                        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-800"><ShieldAlert className="h-4 w-4" aria-hidden="true" /> Critical highlights</h3>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-red-900">
                            {summaryData.critical_highlights.map((h: string, i: number) => <li key={i}>{typeof h === 'string' ? h : JSON.stringify(h)}</li>)}
                          </ul>
                        </section>
                      )}
                      {summaryData.chief_complaint && (
                        <section>
                          <h3 className="mb-1 text-sm font-semibold text-slate-600">Chief complaint</h3>
                          <p className="text-lg font-semibold text-slate-900">{summaryData.chief_complaint}</p>
                        </section>
                      )}
                      {summaryData.small_summary && (
                        <section>
                          <h3 className="mb-1 text-sm font-semibold text-slate-600">Intake summary</h3>
                          <p className="text-base leading-relaxed text-slate-800">{summaryData.small_summary}</p>
                        </section>
                      )}
                      {summaryData.filled_state && typeof summaryData.filled_state === 'object' && Object.keys(summaryData.filled_state.filled_state || {}).length > 0 && (
                        <section>
                          <h3 className="mb-2 text-sm font-semibold text-slate-600">Recorded details</h3>
                          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {Object.entries(summaryData.filled_state.filled_state || {}).map(([key, val]: [string, any]) => (
                              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <dt className="text-xs font-medium capitalize text-slate-500">{key.replace(/_/g, ' ')}</dt>
                                <dd className="text-sm font-semibold text-slate-900">{typeof val === 'object' ? (val?.value || JSON.stringify(val)) : String(val)}</dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      )}
                      {summaryData.contradictions_found && summaryData.contradictions_found.length > 0 && (
                        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <h3 className="mb-2 text-sm font-semibold text-amber-800">Answers that don't match</h3>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                            {summaryData.contradictions_found.map((c: any, i: number) => <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>)}
                          </ul>
                        </section>
                      )}
                    </div>
                  )
                ) : !historyPatientId ? (
                  <p className="text-sm text-slate-500">No patient record linked to this visit.</p>
                ) : historyData.length === 0 ? (
                  <EmptyState icon={<History />} title="No earlier visits" description="This is the patient's first visit recorded in SwasthyaSync." />
                ) : (
                  <ol className="space-y-3">
                    {historyData.map((visit: any, i: number) => (
                      <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-700">
                            {visit.created_at ? new Date(visit.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                          </span>
                          {visit.pdf_path && (
                            <a href={`${getApiBaseUrl()}/api/pdf/${visit.session_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
                              <FileText className="h-4 w-4" aria-hidden="true" /> PDF
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-slate-800">{visit.small_summary || 'No summary available'}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {selected && (
                <div className="shrink-0 border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/encounter/${selected.session_id}`)}
                    className="tap-kiosk w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Start consult <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
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

      {/* Preferences */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="prefs-title">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-elevated"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
                <div>
                  <h2 id="prefs-title" className="text-lg font-bold text-slate-900">Interview preferences</h2>
                  <p className="text-sm text-slate-500">Extra instructions for the kiosk when patients choose you</p>
                </div>
                <button type="button" onClick={() => setShowSettingsModal(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-5">
                <label htmlFor="doc-instructions" className="mb-1.5 block text-sm font-semibold text-slate-700">Instructions for the interviewer</label>
                <textarea
                  id="doc-instructions"
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  placeholder="Example: I am an orthopaedic surgeon. Always ask about past sports injuries and exact pain duration."
                  className="h-32 w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <p className="mt-2 text-sm text-slate-500">Added to the questions the kiosk asks. It doesn't replace them.</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => setShowSettingsModal(false)} className="tap rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">Cancel</button>
                <button type="button" onClick={saveSettings} disabled={isSavingSettings} className="tap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {isSavingSettings ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
