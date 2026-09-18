import { LiquidButton } from '../components/ui/button';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../config';
import { AlertCircle, Clock, CheckCircle, User, Activity, Filter, LogOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function Dashboard_Triage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const fetchQueue = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const url = selectedDoctorId 
        ? `${getApiBaseUrl()}/api/triage/queue?doctor_id=${selectedDoctorId}` 
        : `${getApiBaseUrl()}/api/triage/queue`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (e) {
      console.error('Failed to fetch triage queue:', e);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Auto refresh every 3 seconds for both queue and doctor status
    const interval = setInterval(() => {
      fetchQueue(false);
      fetchDoctors();
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  const criticalCount = queue.filter(q => q.priority_flag).length;

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col overflow-hidden px-8">
        <header className="flex-none mb-6 flex items-center justify-between bg-slate-50 pt-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              Triage Dashboard
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <RefreshCw className={`w-3 h-3 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                Live Sync
              </span>
            </h1>
            <p className="text-slate-500 mt-2">Live emergency prioritization and patient queue</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Doctor Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-card border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={selectedDoctorId}
                onChange={e => setSelectedDoctorId(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 font-semibold cursor-pointer text-sm"
              >
                <option value="">All Doctors (Hospital View)</option>
                {doctors.map(doc => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    Dr. {doc.full_name} ({doc.department}) {doc.current_status === 'Available' ? '🟢 Available' : '🟠 On Break'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-white px-4 py-2 rounded-xl shadow-card border border-slate-200 text-center relative overflow-hidden">
                <motion.div 
                  animate={criticalCount > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className={`text-2xl font-black ${criticalCount > 0 ? 'text-red-600' : 'text-slate-700'}`}
                >
                  {criticalCount}
                </motion.div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical</div>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl shadow-card border border-slate-200 text-center">
                <div className="text-2xl font-black text-blue-600">
                  {queue.length}
                </div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</div>
              </div>

              <LiquidButton 
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 shadow-card text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Exit</span>
              </LiquidButton>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth pb-8">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-card text-slate-500">
            No patients currently in the triage queue.
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {queue.map((item, index) => (
                <motion.div
                  key={item.session_id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.04, 0.3) }}
                  className={`rounded-2xl p-6 shadow-card hover:shadow-card-hover border-l-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-[1px] ${
                    item.priority_flag ? 'border-l-red-500 bg-red-50/40 border-red-200/60' : 'border-l-blue-500 bg-white border-slate-200/80'
                  } border`}
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Token & Status */}
                    <div className="flex-shrink-0 text-center md:w-32">
                      <div className="text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">TOKEN</div>
                      <div className="text-2xl font-black text-slate-800">{item.token_number || item.token_id || 'N/A'}</div>
                      <div className={`mt-2 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                        item.session_status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.session_status === 'COMPLETED' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3 animate-pulse" />}
                        {item.session_status}
                      </div>
                    </div>

                    {/* Patient Info */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-slate-400" />
                        <h3 className="text-xl font-bold text-slate-900">{item.full_name}</h3>
                        {item.priority_flag && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ml-2 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Emergency
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 font-medium">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Age:</span> {item.age || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Sex:</span> {item.gender || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Phone:</span> {item.phone_number}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Arrived:</span> 
                          {new Date(item.created_at + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Triage Input */}
                    <div className="flex-shrink-0 flex flex-col gap-2 md:w-64">
                      <TriageActionPanel item={item} onUpdate={fetchQueue} />
                      <LiquidButton 
                        onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${item.session_id}/pdf`, '_blank')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl transition-colors text-xs border border-slate-200 w-full"
                      >
                        View Clinical Summary
                      </LiquidButton>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        </div>
      </div>
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
      <textarea
        className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-[border-color,box-shadow] bg-slate-50/50"
        placeholder="Enter triage notes / immediate relief..."
        rows={2}
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <LiquidButton
          onClick={() => handleTriageSubmit(false)}
          disabled={isElevating}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-xl text-xs transition-colors"
        >
          Save Notes
        </LiquidButton>
        {!item.priority_flag && (
          <LiquidButton
            onClick={() => handleTriageSubmit(true)}
            disabled={isElevating}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-xl text-xs transition-colors"
          >
            Elevate
          </LiquidButton>
        )}
      </div>
    </div>
  );
}
