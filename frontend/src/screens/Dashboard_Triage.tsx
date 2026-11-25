import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '../config';
import { AlertCircle, CheckCircle2, Clock, Filter, LogOut, FileText, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatTile, EmptyState, ErrorState, Skeleton } from '../components/ui/states';

interface QueueItem {
  session_id: string;
  token_id: string;
  priority_flag: boolean | number;
  session_status: string;
  created_at: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone_number: string;
  token_number?: string;
}

const drName = (name: string) => (/^(dr\.?|vaidya)\s/i.test(name || '') ? name : `Dr. ${name}`);

function minutesSince(iso: string, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.max(0, Math.round((now - t) / 60000));
}

function arrivedAt(iso: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard_Triage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/doctors`);
      if (res.ok) {
        const data = await res.json();
        if (data.doctors) setDoctors(data.doctors);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const url = selectedDoctorId
        ? `${getApiBaseUrl()}/api/triage/queue?doctor_id=${selectedDoctorId}`
        : `${getApiBaseUrl()}/api/triage/queue`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setQueue(data.queue || []);
      setLoadError(false);
      setLastUpdated(Date.now());
    } catch (e) {
      console.error('Failed to fetch triage queue:', e);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchQueue();
    // Auto refresh every 3 seconds for both queue and doctor status
    const interval = setInterval(() => {
      fetchQueue();
      fetchDoctors();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Clock for "updated Ns ago" and waiting times
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isDone = (q: QueueItem) => q.session_status === 'COMPLETED';
  const priority = queue.filter(q => q.priority_flag && !isDone(q));
  const waiting = queue.filter(q => !q.priority_flag && !isDone(q));
  const seen = queue.filter(isDone);
  const waits = [...priority, ...waiting].map(q => minutesSince(q.created_at, now)).filter((m): m is number => m !== null);
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;
  const secondsAgo = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : null;

  const lanes = [
    { key: 'priority', title: 'Priority', hint: 'Red flags and nurse-elevated', items: priority, tone: 'red' as const },
    { key: 'waiting', title: 'Waiting', hint: 'In intake or waiting for the doctor', items: waiting, tone: 'blue' as const },
    { key: 'seen', title: 'Seen', hint: 'Consultation completed', items: seen, tone: 'green' as const },
  ];

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Triage queue</h1>
            <p className="flex items-center gap-1.5 text-sm text-slate-500" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${loadError ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden="true" />
              {loadError
                ? 'Not updating · server unreachable'
                : secondsAgo === null ? 'Connecting…' : `Live · updated ${secondsAgo}s ago`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-600/30 sm:flex-initial">
              <Filter className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="sr-only">Filter by doctor</span>
              <select
                value={selectedDoctorId}
                onChange={e => { setIsLoading(true); setSelectedDoctorId(e.target.value); }}
                className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 outline-none cursor-pointer"
              >
                <option value="">All doctors</option>
                {doctors.map(doc => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    {drName(doc.full_name)} · {doc.department}{doc.current_status ? ` · ${doc.current_status === 'Available' ? 'Available' : 'On break'}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="tap inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Exit
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          {/* Summary before detail */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Priority" value={priority.length} tone={priority.length ? 'danger' : 'neutral'} hint="Needs attention first" />
            <StatTile label="Waiting" value={waiting.length} tone="info" />
            <StatTile label="Seen" value={seen.length} tone="success" />
            <StatTile label="Average wait" value={avgWait === null ? '–' : `${avgWait} min`} hint="Patients not yet seen" />
          </div>

          {loadError && queue.length === 0 && !isLoading && (
            <ErrorState
              className="mt-5"
              title="Can't load the triage queue"
              description="The hospital server isn't responding. The page keeps retrying every few seconds."
              onRetry={fetchQueue}
            />
          )}

          {isLoading ? (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-28 rounded-xl" />
                  <Skeleton className="h-28 rounded-xl" />
                </div>
              ))}
            </div>
          ) : queue.length === 0 && !loadError ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-card">
              <EmptyState
                icon={<Inbox />}
                title="The queue is clear"
                description="New patients appear here as soon as they finish at the kiosk. Red-flag cases go straight to Priority."
              />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {lanes.map(lane => (
                <section key={lane.key} aria-labelledby={`lane-${lane.key}`} className="min-w-0">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h2 id={`lane-${lane.key}`} className="flex items-center gap-2 text-base font-semibold text-slate-900">
                      <span className={`h-2.5 w-2.5 rounded-full ${lane.tone === 'red' ? 'bg-red-600' : lane.tone === 'blue' ? 'bg-blue-600' : 'bg-emerald-600'}`} aria-hidden="true" />
                      {lane.title}
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700 tabular-nums">{lane.items.length}</span>
                    </h2>
                    <span className="truncate text-xs text-slate-500">{lane.hint}</span>
                  </div>
                  <div className="space-y-3">
                    {lane.items.length === 0 && (
                      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">No patients</p>
                    )}
                    <AnimatePresence initial={false}>
                      {lane.items.map(item => {
                        const wait = minutesSince(item.created_at, now);
                        return (
                          <motion.article
                            key={item.session_id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-card ${
                              lane.tone === 'red' ? 'border-l-red-600' : lane.tone === 'blue' ? 'border-l-blue-600' : 'border-l-emerald-600'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-bold text-slate-900">{item.full_name}</h3>
                                <p className="text-sm text-slate-600">
                                  {[item.age ? `${item.age} y` : null, item.gender].filter(Boolean).join(' · ') || 'Age and sex not recorded'}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs text-slate-500">Token</p>
                                <p className="text-lg font-bold leading-tight text-slate-900 tabular-nums">{item.token_number || item.token_id || '–'}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                              {lane.tone === 'red' && (
                                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> Emergency
                                </span>
                              )}
                              {lane.tone === 'green' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Seen</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                  {wait === null ? `Arrived ${arrivedAt(item.created_at)}` : `Waiting ${wait} min · arrived ${arrivedAt(item.created_at)}`}
                                </span>
                              )}
                              {item.phone_number && <span className="tabular-nums">{item.phone_number}</span>}
                            </div>

                            <div className="mt-3 flex flex-col gap-2">
                              <TriageActionPanel item={item} onUpdate={fetchQueue} />
                              <button
                                type="button"
                                onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${item.session_id}/pdf`, '_blank')}
                                className="tap inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <FileText className="h-4 w-4" aria-hidden="true" /> Clinical summary (PDF)
                              </button>
                            </div>
                          </motion.article>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Sub-component for Triage Actions to manage state per item
function TriageActionPanel({ item, onUpdate }: { item: QueueItem; onUpdate: () => void }) {
  const [notes, setNotes] = useState('');
  const [isElevating, setIsElevating] = useState(false);

  const handleTriageSubmit = async (elevate: boolean) => {
    setIsElevating(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/session/${item.session_id}/nurse-triage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurse_triage_notes: notes || 'No notes added.',
          elevate_to_priority: elevate
        })
      });
      setNotes('');
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setIsElevating(false);
    }
  };

  if (item.session_status === 'COMPLETED') return null;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`notes-${item.session_id}`} className="sr-only">Triage notes for {item.full_name}</label>
      <textarea
        id={`notes-${item.session_id}`}
        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        placeholder="Triage notes or relief given…"
        rows={2}
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleTriageSubmit(false)}
          disabled={isElevating}
          className="tap flex-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          Save notes
        </button>
        {!item.priority_flag && (
          <button
            type="button"
            onClick={() => handleTriageSubmit(true)}
            disabled={isElevating}
            className="tap flex-1 rounded-lg border-2 border-red-600 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
          >
            Move to priority
          </button>
        )}
      </div>
    </div>
  );
}
