import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Clock, AlertTriangle, FileText, ShieldAlert, Zap, Timer, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { getApiBaseUrl } from '../config';

const API_BASE = `${getApiBaseUrl()}/api/admin`;

const COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// ── Tiny sparkline component with SVG stroke-dashoffset draw-in ──
function Sparkline({ data, color = '#2563eb' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return <div className="h-8 w-24" />;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 96},${32 - (v / max) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 96 32" className="h-8 w-24 overflow-visible" preserveAspectRatio="none">
      <motion.polyline 
        fill="none" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        points={points}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

// ── KPI Card with AnimatedNumber count-up ──
function KpiCard({ icon: Icon, label, value, sparkData, sparkColor, accent = 'blue', delay = 0 }: any) {
  const accents: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  const numeric = typeof value === 'number' ? value : parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  const suffix = typeof value === 'string' ? String(value).replace(/[0-9.]/g, '') : '';
  const canAnimate = !isNaN(numeric);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay }}
      className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-card hover:shadow-card-hover transition-[box-shadow,transform] duration-200 hover:-translate-y-[1px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-2xl border ${accents[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline">
        {canAnimate ? (
          <>
            <AnimatedNumber value={numeric} />
            {suffix && <span className="text-xl font-bold ml-0.5 text-slate-500">{suffix}</span>}
          </>
        ) : (
          value ?? 0
        )}
      </div>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">{label}</div>
    </motion.div>
  );
}

// ── Impact Card with subtle gradient & count-up ──
function ImpactCard({ icon: Icon, label, value, sub, delay = 0 }: any) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  const suffix = typeof value === 'string' ? String(value).replace(/[0-9.]/g, '') : '';
  const canAnimate = !isNaN(numeric);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay }}
      className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-elevated border border-slate-700/40 relative overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-emerald-400" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black flex items-baseline">
        {canAnimate ? (
          <>
            <AnimatedNumber value={numeric} />
            {suffix && <span className="text-lg font-bold ml-0.5 text-emerald-400">{suffix}</span>}
          </>
        ) : (
          value ?? 0
        )}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1 font-medium">{sub}</div>}
    </motion.div>
  );
}

// ── Date range presets ──
function getDateRange(preset: string) {
  const end = new Date();
  const start = new Date();
  if (preset === '7d') start.setDate(end.getDate() - 7);
  else if (preset === '30d') start.setDate(end.getDate() - 30);
  else if (preset === '90d') start.setDate(end.getDate() - 90);
  else return { start: '', end: '' }; // 'all'
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

export function AnalyticsDashboard() {
  const [datePreset, setDatePreset] = useState('30d');
  const [dashData, setDashData] = useState<any>(null);
  const [impactData, setImpactData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { start, end } = getDateRange(datePreset);
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);

    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/dashboard-data?${params}`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/impact-metrics`).then(r => r.json()).catch(() => null),
    ]).then(([dash, impact]) => {
      setDashData(dash);
      setImpactData(impact);
      setLoading(false);
    });
  }, [datePreset]);

  // Aggregate footfall by date for the main chart (sum across departments)
  const footfallChartData = useMemo(() => {
    if (!dashData?.footfall_by_date) return [];
    const byDate: Record<string, any> = {};
    for (const row of dashData.footfall_by_date) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date, total: 0 };
      byDate[row.date][row.department] = (byDate[row.date][row.department] || 0) + row.count;
      byDate[row.date].total += row.count;
    }
    return Object.values(byDate);
  }, [dashData]);

  const allDepartments = useMemo(() => {
    if (!dashData?.department_breakdown) return [];
    return dashData.department_breakdown.map((d: any) => d.department);
  }, [dashData]);

  // Aggregate red flags for chart
  const redFlagChartData = useMemo(() => {
    if (!dashData?.red_flags_over_time) return [];
    const byDate: Record<string, any> = {};
    for (const row of dashData.red_flags_over_time) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date, conversational: 0, document: 0 };
      byDate[row.date][row.source] += row.count;
    }
    return Object.values(byDate);
  }, [dashData]);

  if (loading || !dashData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const kpi = dashData.kpi || {};
  const sparklines = dashData.sparklines || {};

  return (
    <div className="space-y-6">
      {/* Header + Date Range */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
          Analytics Dashboard
        </h2>
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 border border-slate-200/60">
          {['7d', '30d', '90d', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`relative px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                datePreset === p ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {datePreset === p && (
                <motion.div
                  layoutId="active-date-preset"
                  className="absolute inset-0 bg-white rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{p === 'all' ? 'All Time' : p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard icon={Users} label="Total Footfall" value={kpi.total_footfall_range} sparkData={sparklines.footfall_7d} sparkColor="#2563eb" accent="blue" delay={0.02} />
        <KpiCard icon={TrendingUp} label="Today's Footfall" value={kpi.today_footfall} accent="emerald" delay={0.05} />
        <KpiCard icon={Clock} label="Avg Intake Time" value={`${kpi.avg_intake_minutes}m`} accent="purple" delay={0.08} />
        <KpiCard icon={AlertTriangle} label="Red Flags" value={kpi.priority_count_range} sparkData={sparklines.priority_7d} sparkColor="#ef4444" accent="red" delay={0.11} />
        <KpiCard icon={FileText} label="Docs OCR'd" value={kpi.docs_ocrd} accent="amber" delay={0.14} />
      </div>

      {/* Impact Metrics Row */}
      {impactData && (
        <div className="grid grid-cols-4 gap-4">
          <ImpactCard icon={Zap} label="Sessions Completed" value={impactData.total_completed} sub={`${impactData.total_sessions} total sessions`} delay={0.16} />
          <ImpactCard icon={Timer} label="Avg Intake" value={`${impactData.avg_intake_minutes}m`} sub="vs. 15m manual estimate" delay={0.19} />
          <ImpactCard icon={Award} label="Hours Saved" value={`${impactData.estimated_hours_saved}h`} sub={`${impactData.savings_per_patient_min}m saved per patient`} delay={0.22} />
          <ImpactCard icon={ShieldAlert} label="Red Flags Caught" value={impactData.total_red_flags_caught} sub={`${impactData.total_docs_ocrd} docs processed`} delay={0.25} />
        </div>
      )}

      {/* Main Chart: Footfall Over Time */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card"
      >
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Footfall Over Time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={footfallChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {allDepartments.map((dept: string, i: number) => (
              <Bar key={dept} dataKey={dept} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === allDepartments.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Two charts row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card"
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Department Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dashData.department_breakdown}
                dataKey="count"
                nameKey="department"
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                strokeWidth={2}
                stroke="#fff"
              >
                {dashData.department_breakdown.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Complaint Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card"
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Top Complaints</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dashData.complaint_breakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <YAxis dataKey="complaint" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Red Flags Over Time */}
      {redFlagChartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card"
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
            <ShieldAlert className="w-4 h-4 inline mr-2 text-red-500" />
            Red Flags Caught Over Time
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={redFlagChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="conversational" stackId="1" stroke="#ef4444" fill="#fecaca" name="Conversational" />
              <Area type="monotone" dataKey="document" stackId="1" stroke="#f59e0b" fill="#fef3c7" name="Document-based" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}

// ── Red Flag Feed Component ──
export function RedFlagFeed() {
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    const fetchFlags = () => {
      fetch(`${API_BASE}/red-flags-live`)
        .then(r => r.json())
        .then(data => setFlags(Array.isArray(data) ? data : []))
        .catch(console.error);
    };
    fetchFlags();
    const interval = setInterval(fetchFlags, 3000);
    return () => clearInterval(interval);
  }, []);

  const parseReason = (reason: string) => {
    if (!reason) return { ruleId: 'UNKNOWN', description: 'No reason recorded' };
    const parts = reason.split(': ');
    if (parts.length >= 2) return { ruleId: parts[0].trim(), description: parts.slice(1).join(': ').trim() };
    return { ruleId: 'FLAG', description: reason };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
          Live Red-Flag Feed
        </h2>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Auto-refreshes every 3s
        </span>
      </div>

      {flags.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-card">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-400" />
          <p className="text-base font-bold text-slate-600">No active red flags</p>
          <p className="text-xs text-slate-400 mt-1">All patients in today's OPD are at normal priority</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f, i) => {
            const { ruleId, description } = parseReason(f.priority_reason);
            const timeSince = f.created_at ? Math.round((Date.now() - new Date(f.created_at).getTime()) / 60000) : 0;
            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                className="bg-red-50/50 border border-red-200/80 rounded-2xl p-5 flex items-start gap-4 hover:bg-red-50 transition-colors shadow-card"
              >
                <div className="relative mt-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{f.full_name}</span>
                    <span className="text-xs font-extrabold text-red-600 bg-red-100 px-2.5 py-0.5 rounded-full">{f.token_id}</span>
                    <span className="text-xs font-semibold text-slate-500">{f.department}</span>
                    <span className="text-xs text-slate-400 ml-auto">{timeSince}m ago</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono font-bold text-red-700 bg-red-100 px-2 py-1 rounded-lg">{ruleId}</span>
                    <span className="text-sm text-slate-700 font-medium">{description}</span>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-slate-500 font-medium">
                    <span>{f.age ? `${f.age}y` : ''} {f.gender || ''}</span>
                    <span>•</span>
                    <span>Status: <strong className={f.session_status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-emerald-600'}>{f.session_status}</strong></span>
                    {f.chief_complaint && <><span>•</span><span>CC: {f.chief_complaint}</span></>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
