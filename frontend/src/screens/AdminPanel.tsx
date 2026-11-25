import { LiquidButton } from '../components/ui/button';
import { StaffSignIn } from '../components/StaffSignIn';
import { StatTile, EmptyState } from '../components/ui/states';
import { toast } from '../components/Toast';
import { LogoutDialog } from '../components/LogoutDialog';
import { AnalyticsDashboard, RedFlagFeed } from './AnalyticsDashboard';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Lock, Plus, LogOut, Calendar, UploadCloud, FileText,
  Activity, Users, LayoutList, Stethoscope, Settings, List, AlertTriangle, X, Search, DownloadCloud, TrendingUp, ShieldAlert, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBaseUrl } from '../config';

const API_BASE = `${getApiBaseUrl()}/api/admin`;
const ADMIN_EMAIL = 'mdzeeshan08886@gmail.com';
const ADMIN_PASS = 'zeeshan';

const todayDate = new Intl.DateTimeFormat('en-IN', { 
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
}).format(new Date());

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('swasthya_admin_auth') === 'true';
  });
  const [authError, setAuthError] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState('analytics');
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [showEditDocModal, setShowEditDocModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);

  // Data State
  const [analytics, setAnalytics] = useState({ total_footfall: 0, avg_wait_time: '0m', emergency_active: 0 });
  const [queues, setQueues] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Forms State
  const [newDept, setNewDept] = useState('');
  const [newDoc, setNewDoc] = useState({ full_name: '', dept_id: '', license_number: '', profile_image_url: '', max_daily_patients: 40, room_number: '', username: '', password: '' });
  const [newRule, setNewRule] = useState({ trigger_keyword: '', action_type: 'ESCALATE', action_value: '' });
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogin = (email: string, password: string) => {
    if (email.trim() === ADMIN_EMAIL && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      localStorage.setItem('swasthya_admin_auth', 'true');
      setAuthError('');
      fetchAllData();
    } else {
      setAuthError("That email and password don't match an admin account.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('swasthya_admin_auth');
    navigate('/');
  };

  const isFetchingRef = useRef(false);

  const fetchAllData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [anRes, quRes, docRes, depRes, patRes, rulRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/analytics`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/queues`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/doctors`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/departments`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/patients`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/rules`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/logs`).then(r => r.json()).catch(() => [])
      ]);
      setAnalytics(anRes || { total_footfall: 0, avg_wait_time: '0m', emergency_active: 0 });
      setQueues(Array.isArray(quRes) ? quRes : []);
      setDoctors(Array.isArray(docRes) ? docRes : []);
      setDepartments(Array.isArray(depRes) ? depRes : []);
      setPatients(Array.isArray(patRes) ? patRes : []);
      setRules(Array.isArray(rulRes) ? rulRes : []);
      setLogs(Array.isArray(logRes) ? logRes : []);

      // Also fetch notifications
      fetch(`${API_BASE}/notifications`)
        .then(r => r.json())
        .then(d => setNotifications(d.notifications || []))
        .catch(() => {});
    } catch (e) {
      console.error('Data fetch error:', e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleMarkNotificationRead = async (notif_id: string) => {
    await fetch(`${API_BASE}/notifications/${notif_id}/read`, { method: 'PUT' });
    setNotifications(prev => prev.filter(n => n.notif_id !== notif_id));
  };

  const handleDowngrade = async (session_id: string) => {
    await fetch(`${API_BASE}/queue/${session_id}/downgrade`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: ADMIN_EMAIL })
    });
    fetchAllData();
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDept })
    });
    setNewDept('');
    fetchAllData();
  };

  const handleSetDefaultDept = async (deptId: string) => {
    await fetch(`${API_BASE}/departments/${deptId}/default`, {
      method: 'PUT'
    });
    fetchAllData();
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newDoc, dept_id: parseInt(newDoc.dept_id), admin_email: ADMIN_EMAIL })
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(`Failed to add doctor: ${errorData.detail || res.statusText}`);
        return;
      }
      setNewDoc({ full_name: '', dept_id: '', license_number: '', profile_image_url: '', max_daily_patients: 40, room_number: '', username: '', password: '' });
      setShowAddDocModal(false);
      fetchAllData();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    try {
      const res = await fetch(`${API_BASE}/doctors/${editingDoctor.doctor_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...editingDoctor, 
          dept_id: parseInt(editingDoctor.dept_id),
          admin_email: ADMIN_EMAIL
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(`Failed to update doctor: ${errorData.detail || res.statusText}`);
        return;
      }
      setShowEditDocModal(false);
      fetchAllData();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };


  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRule)
    });
    setNewRule({ trigger_keyword: '', action_type: 'ESCALATE', action_value: '' });
    fetchAllData();
  };

  const handleResetClinic = async () => {
    await fetch(`${API_BASE}/reset-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_email: ADMIN_EMAIL })
    });
    setShowDangerModal(false);
    fetchAllData();
  };

  const handlePatientUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    
    await fetch(`${API_BASE}/patients/${editingPatient.patient_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_email: ADMIN_EMAIL,
        updates: {
          phone_number: editingPatient.phone_number,
          full_name: editingPatient.full_name
        }
      })
    });
    setShowEditModal(false);
    fetchAllData();
  };

  if (!isAuthenticated) {
    return (
      <StaffSignIn
        title="Admin sign in"
        subtitle="Hospital operations and settings"
        icon={<Lock className="h-6 w-6" aria-hidden="true" />}
        accent="purple"
        idLabel="Admin email"
        idType="email"
        idAutoComplete="email"
        error={authError}
        onSubmit={handleLogin}
        onBack={() => navigate('/')}
      />
    );
  }

  const filteredQueues = selectedDeptFilter === 'ALL' 
    ? queues 
    : queues.filter(q => q.department === selectedDeptFilter);
    
  const priorityQueues = filteredQueues.filter(q => q.priority_flag);
  const normalQueues = filteredQueues.filter(q => !q.priority_flag);

  const tabs = [
    { id: 'analytics', icon: TrendingUp, label: 'Overview', group: 'Monitor' },
    { id: 'red_flags', icon: ShieldAlert, label: 'Red flags', group: 'Monitor' },
    { id: 'live_queue', icon: Activity, label: 'Live queue', group: 'Monitor' },
    { id: 'departments', icon: LayoutList, label: 'Departments', group: 'Manage' },
    { id: 'doctors', icon: Stethoscope, label: 'Doctors', group: 'Manage' },
    { id: 'patients', icon: Users, label: 'Patients', group: 'Manage' },
    { id: 'rules', icon: Settings, label: 'Clinical rules', group: 'Manage' },
    { id: 'logs', icon: List, label: 'Audit log', group: 'System' },
    { id: 'reset', icon: AlertTriangle, label: 'End-of-day reset', group: 'System' },
  ];

  const handleExportDB = async () => {
    try {
      const res = await fetch(`${API_BASE}/export-db`);
      if (!res.ok) throw new Error('Failed to export DB');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'health_officer_export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      toast.error('Database download failed. Check the server is running and try again.');
      console.error(err);
    }
  };

  const activeLabel = tabs.find(t => t.id === activeTab)?.label || '';
  return (
    <div className="h-[100dvh] w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <nav aria-label="Admin sections" className="shrink-0 border-b border-slate-200 bg-white md:w-60 md:border-b-0 md:border-r flex md:flex-col">
        <div className="hidden md:flex items-center gap-2.5 px-4 h-16 border-b border-slate-200">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-base font-bold text-slate-900">Admin</span>
        </div>
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto p-2 md:p-3 flex-1">
          {['Monitor', 'Manage', 'System'].map(group => (
            <div key={group} className="flex md:flex-col gap-1 md:mb-3">
              <p className="hidden md:block px-3 pt-1 pb-1 text-xs font-semibold text-slate-500">{group}</p>
              {tabs.filter(t => t.group === group).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`tap flex shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id ? 'bg-purple-50 font-semibold text-purple-800' : 'font-medium text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-purple-700' : tab.id === 'reset' || tab.id === 'red_flags' ? 'text-red-600' : 'text-slate-500'}`} aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{activeLabel}</h1>
              <p className="flex items-center gap-1.5 text-sm text-slate-500"><Calendar className="h-4 w-4" aria-hidden="true" /> {todayDate}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Doctor notifications${notifications.length ? `: ${notifications.length} new` : ''}`}
                  aria-expanded={showNotifications}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {notifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-bold leading-5 text-white tabular-nums">{notifications.length}</span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated">
                    <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Doctor notifications</p>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-sm text-slate-500">No new notifications</p>
                      ) : (
                        notifications.map(n => (
                          <div key={n.notif_id} className="border-b border-slate-100 p-4">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900">{n.doctor_name}</span>
                              <span className="text-xs text-slate-500 tabular-nums">{new Date(n.timestamp + 'Z').toLocaleTimeString()}</span>
                            </div>
                            <p className="mb-2 text-sm text-slate-700">{n.message}</p>
                            <button type="button" onClick={() => handleMarkNotificationRead(n.notif_id)} className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer">
                              Mark as read
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={handleExportDB} className="tap hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                <DownloadCloud className="h-4 w-4" aria-hidden="true" /> Export data
              </button>
              <button type="button" onClick={() => setShowLogoutDialog(true)} className="tap inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Patients today" value={analytics.total_footfall} />
              <StatTile label="Average wait" value={analytics.avg_wait_time} />
              <StatTile label="Active emergencies" value={analytics.emergency_active} tone={analytics.emergency_active > 0 ? 'danger' : 'neutral'} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
            
            {activeTab === 'analytics' && <AnalyticsDashboard />}

            {activeTab === 'red_flags' && <RedFlagFeed />}

            {activeTab === 'live_queue' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-600" /> Live Queue Control</h2>
                  <select 
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-200"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map(d => (
                      <option key={d.dept_id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-red-600 font-bold mb-3">Priority Queue ({priorityQueues.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {priorityQueues.map((q, i) => (
                      <div key={i} className="bg-red-50 border border-red-200/50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-900 text-lg">Token: {q.token_number || q.token_id}</span>
                          <LiquidButton onClick={() => handleDowngrade(q.session_id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded border border-red-200/50 transition">Downgrade to Normal</LiquidButton>
                        </div>
                        <p className="text-sm text-slate-700">Patient ID: {q.patient_id || q.full_name}</p>
                        <p className="text-xs text-red-600 mt-2 bg-red-100 px-2 py-1 rounded inline-block">Reason: {q.priority_reason}</p>
                        <div className="mt-3">
                          <LiquidButton 
                            onClick={() => window.open(`${API_BASE.replace('/api/admin', '')}/api/summary/${q.session_id}/pdf`, '_blank')}
                            className="w-full text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-2 rounded border border-emerald-200/50 transition text-center"
                          >
                            View Clinical Summary
                          </LiquidButton>
                        </div>
                      </div>
                    ))}
                    {priorityQueues.length === 0 && <p className="text-slate-500 text-sm">No active priorities.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="text-emerald-600 font-bold mb-3">Normal Queue ({normalQueues.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {normalQueues.map((q, i) => (
                      <div key={i} className="bg-slate-50 rounded-2xl p-4 shadow-soft-1 hover:shadow-soft-2 transition-all flex flex-col justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-lg">Token: {q.token_number || q.token_id}</span>
                          <p className="text-sm text-slate-500 mt-1">Patient ID: {q.patient_id || q.full_name}</p>
                          <p className="text-xs text-slate-500 mt-1">{q.created_at}</p>
                        </div>
                        <div className="mt-3">
                          <LiquidButton 
                            onClick={() => window.open(`${API_BASE.replace('/api/admin', '')}/api/summary/${q.session_id}/pdf`, '_blank')}
                            className="w-full text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-2 rounded border border-emerald-200/50 transition text-center"
                          >
                            View Clinical Summary
                          </LiquidButton>
                        </div>
                      </div>
                    ))}
                    {normalQueues.length === 0 && <p className="text-slate-500 text-sm">No normal queues.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'departments' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center"><LayoutList className="w-5 h-5 mr-2 text-emerald-600" /> Department Manager</h2>
                <form onSubmit={handleAddDept} className="flex space-x-3 mb-6 bg-white p-4 rounded-lg border border-slate-200">
                  <input type="text" required value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="New Department Name" className="flex-1 bg-slate-50 border border-slate-300 rounded px-4 py-2 text-slate-900 focus:border-emerald-200" />
                  <LiquidButton type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded">Add Dept</LiquidButton>
                </form>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {departments.map(d => (
                    <div key={d.dept_id} className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-semibold text-slate-900 text-lg">{d.name}</span>
                        <span className="text-xs text-slate-500">ID: {d.dept_id}</span>
                      </div>
                      <LiquidButton
                        onClick={() => handleSetDefaultDept(d.dept_id)}
                        disabled={d.is_default}
                        className={`w-full py-2 rounded font-bold text-xs transition ${
                          d.is_default 
                            ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-200/30' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.is_default ? 'Default Registration Dept' : 'Set as Default'}
                      </LiquidButton>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'doctors' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900 tabular-nums">{doctors.length}</span> doctors registered</p>
                  <button type="button" onClick={() => setShowAddDocModal(true)} className="tap inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 cursor-pointer">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add doctor
                  </button>
                </div>
                {doctors.length === 0 ? (
                  <EmptyState icon={<Stethoscope />} title="No doctors yet" description="Add a doctor so patients can choose them at the kiosk." />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-semibold">Doctor</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Room</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Seen today</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {doctors.map(doc => {
                          const seen = doc.total_seen_today || 0;
                          const cap = doc.max_daily_patients || 0;
                          const pct = cap ? Math.min(100, (seen / cap) * 100) : 0;
                          const available = (doc.current_status || 'Available') === 'Available';
                          return (
                            <tr key={doc.doctor_id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {doc.profile_image_url ? (
                                    <img src={doc.profile_image_url} alt="" className="h-9 w-9 rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  ) : (
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Stethoscope className="h-4 w-4" aria-hidden="true" /></span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900">{doc.full_name}</p>
                                    <p className="text-xs text-slate-500">{doc.license_number || 'No licence number'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{doc.dept_name || doc.department || doc.dept_id}</td>
                              <td className="px-4 py-3 text-slate-700">{doc.room_number || '–'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold ${available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                                  {available ? 'Available' : 'On break'}
                                </span>
                                {doc.status && doc.status !== 'Active' && <span className="ml-2 text-xs font-semibold text-red-700">{doc.status}</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="tabular-nums text-slate-900">{seen}<span className="text-slate-500"> / {cap || '–'}</span></span>
                                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                                    <span className={`block h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button type="button" onClick={() => { setEditingDoctor(doc); setShowEditDocModal(true); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'patients' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center"><Users className="w-5 h-5 mr-2 text-emerald-600" /> Patient Master View</h2>
                  <div className="relative w-64">
                    <Search className="absolute inset-y-2 left-3 w-5 h-5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search patients..." 
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-slate-900 focus:border-emerald-200 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Phone (Family)</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {patients.filter(p => 
                        p.full_name?.toLowerCase().includes(patientSearchQuery.toLowerCase()) || 
                        p.phone_number?.includes(patientSearchQuery) || 
                        p.patient_id?.toLowerCase().includes(patientSearchQuery.toLowerCase())
                      ).map(p => (
                        <tr key={p.patient_id} className="hover:bg-slate-100/50 transition">
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.patient_id.substring(0,8)}</td>
                          <td className="px-4 py-3 text-slate-900">{p.phone_number}</td>
                          <td className="px-4 py-3 text-slate-900 font-medium">{p.full_name}</td>
                          <td className="px-4 py-3 text-slate-500">{new Date(p.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {p.latest_session_id && (
                                <LiquidButton 
                                  onClick={() => window.open(`${API_BASE.replace('/api/admin', '')}/api/summary/${p.latest_session_id}/pdf`, '_blank')} 
                                  className="text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200/30 px-3 py-1.5 rounded text-purple-600 font-medium transition flex items-center"
                                >
                                  <FileText className="w-3 h-3 mr-1" /> Summary
                                </LiquidButton>
                              )}
                              <LiquidButton onClick={() => { setEditingPatient(p); setShowEditModal(true); }} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded text-blue-600 font-medium transition">Edit Details</LiquidButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {patients.length > 0 && patients.filter(p => 
                        p.full_name?.toLowerCase().includes(patientSearchQuery.toLowerCase()) || 
                        p.phone_number?.includes(patientSearchQuery) || 
                        p.patient_id?.toLowerCase().includes(patientSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No patients match your search.</td>
                        </tr>
                      )}
                      {patients.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No patients found in the database.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center"><Settings className="w-5 h-5 mr-2 text-purple-600" /> Clinical Rules Engine</h2>
                <form onSubmit={handleAddRule} className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
                  <div><label className="text-xs text-slate-500 mb-1 block">Trigger Keyword</label><input type="text" required value={newRule.trigger_keyword} onChange={e=>setNewRule({...newRule, trigger_keyword: e.target.value})} placeholder="e.g. chest pain" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Action Type</label>
                    <select value={newRule.action_type} onChange={e=>setNewRule({...newRule, action_type: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900">
                      <option value="ESCALATE">ESCALATE</option>
                      <option value="FLAG">FLAG</option>
                      <option value="ROUTE">ROUTE DEPT</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Action Value (Optional)</label><input type="text" value={newRule.action_value} onChange={e=>setNewRule({...newRule, action_value: e.target.value})} placeholder="e.g. Cardiology" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <LiquidButton type="submit" className="bg-purple-600 hover:bg-purple-700 text-slate-900 font-bold py-2 rounded">Add Rule</LiquidButton>
                </form>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {rules.map(r => (
                    <div key={r.rule_id} className="bg-white border border-slate-200 p-4 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Trigger:</p>
                      <h4 className="font-bold text-slate-900 text-lg mb-2">"{r.trigger_keyword}"</h4>
                      <div className="flex space-x-2">
                        <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-600 font-semibold">{r.action_type}</span>
                        {r.action_value && <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{r.action_value}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200/60 shadow-lg">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center">
                    <List className="w-6 h-6 mr-3 text-slate-500" />
                    System Audit Ledger
                  </h2>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200/60">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Timestamp</th>
                        <th className="px-6 py-4 font-semibold">Admin Identity</th>
                        <th className="px-6 py-4 font-semibold">Action Triggered</th>
                        <th className="px-6 py-4 font-semibold">Target Object ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            No audit trails found in the database.
                          </td>
                        </tr>
                      ) : (
                        logs.map((l) => (
                          <tr key={l.log_id} className="hover:bg-slate-100/20 transition-colors group">
                            <td className="px-6 py-4">
                              <span className="text-slate-500 font-mono text-xs bg-white/50 px-2 py-1 rounded border border-slate-200">
                                {new Date(l.timestamp).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-medium">
                              <div className="flex items-center">
                                <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center mr-2">
                                  <ShieldCheck className="w-3 h-3 text-purple-600" />
                                </div>
                                {l.admin_email}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-blue-600 font-semibold text-xs tracking-wide uppercase px-2 py-1 bg-blue-50 rounded-md border border-blue-200/20">
                                {l.action_type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-slate-500 font-mono text-xs flex items-center">
                                <FileText className="w-3 h-3 mr-1.5 text-slate-500" />
                                {l.target_id || 'Global'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reset' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-12 h-12 text-red-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Danger Zone</h2>
                <p className="text-slate-500 max-w-lg mb-8">This action will archive all IN_PROGRESS queues. It should only be used at the end of the day or in case of a system-wide reset. Active patient records will be preserved.</p>
                <LiquidButton onClick={() => setShowDangerModal(true)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(255,77,79,0.4)] transition transform hover:scale-105 active:scale-[0.97]">Initialize EOD Reset</LiquidButton>
              </div>
            )}

              </motion.div>
            </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Modal */}
      <AnimatePresence>
        {showDangerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-red-200/50 p-8 rounded-2xl max-w-md w-full shadow-elevated"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Confirm Reset</h3>
              <p className="text-slate-700 mb-6">Are you absolutely sure? This will archive {normalQueues.length + priorityQueues.length} active queues.</p>
              <div className="flex space-x-4">
                <LiquidButton onClick={() => setShowDangerModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl">Cancel</LiquidButton>
                <LiquidButton onClick={handleResetClinic} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Yes, Reset Now</LiquidButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Patient Modal */}
      <AnimatePresence>
        {showEditModal && editingPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-elevated"
            >
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">Edit Patient Record</h3>
                <LiquidButton onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></LiquidButton>
              </div>
              <form onSubmit={handlePatientUpdate} className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Full Name</label>
                  <input type="text" required value={editingPatient.full_name} onChange={e=>setEditingPatient({...editingPatient, full_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Phone Number (Family)</label>
                  <input type="text" required value={editingPatient.phone_number} onChange={e=>setEditingPatient({...editingPatient, phone_number: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" />
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200 mt-4">
                  <p className="text-xs text-slate-500 mb-1">Patient ID (Read-Only)</p>
                  <p className="text-sm font-mono text-slate-700 truncate">{editingPatient.patient_id}</p>
                </div>
                <LiquidButton type="submit" className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">Save Changes</LiquidButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Doctor Modal */}
      <AnimatePresence>
        {showAddDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-elevated"
            >
              <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 flex items-center"><Stethoscope className="w-5 h-5 mr-2 text-blue-600" /> Register Provider</h3>
                <LiquidButton onClick={() => setShowAddDocModal(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></LiquidButton>
              </div>
              <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
                <div><label className="text-xs text-slate-500 mb-1 block">Full Name</label><input type="text" required value={newDoc.full_name} onChange={e=>setNewDoc({...newDoc, full_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">License No</label><input type="text" required value={newDoc.license_number} onChange={e=>setNewDoc({...newDoc, license_number: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Room Number</label><input type="text" value={newDoc.room_number} onChange={e=>setNewDoc({...newDoc, room_number: e.target.value})} placeholder="e.g. 101" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">Username</label><input type="text" required value={newDoc.username} onChange={e=>setNewDoc({...newDoc, username: e.target.value})} placeholder="Doctor Username" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Password</label><input type="password" required value={newDoc.password} onChange={e=>setNewDoc({...newDoc, password: e.target.value})} placeholder="Secure Password" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">Department</label>
                    <select required value={newDoc.dept_id} onChange={e=>setNewDoc({...newDoc, dept_id: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900">
                      <option value="">Select Dept</option>
                      {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Max Daily Patients</label><input type="number" required value={newDoc.max_daily_patients} onChange={e=>setNewDoc({...newDoc, max_daily_patients: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div className="pt-2">
                  <label className="text-xs text-slate-500 mb-2 block">Profile Image (Drag & Drop or Select File)</label>
                  <div 
                    className="border-2 border-dashed border-slate-300 hover:border-blue-200/50 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 transition-colors relative group"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-200', 'bg-blue-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-200', 'bg-blue-50'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-200', 'bg-blue-50');
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setNewDoc({ ...newDoc, profile_image_url: event.target.result.toString() });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    {newDoc.profile_image_url ? (
                      <div className="relative w-full flex justify-center">
                        <img src={newDoc.profile_image_url} alt="Preview" className="h-20 w-20 rounded-full object-cover border-2 border-blue-200/30" />
                        <LiquidButton 
                          type="button"
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); setNewDoc({ ...newDoc, profile_image_url: '' }); }}
                          className="absolute -top-2 -right-2 md:right-1/4 bg-red-600 text-white rounded-full p-1 hover:bg-red-500 shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </LiquidButton>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-blue-600 transition-colors" />
                        <p className="text-xs text-slate-500 mb-3">Drag image here or select from device</p>
                        <label className="cursor-pointer bg-white hover:bg-slate-100 border border-slate-300 hover:border-blue-200/50 text-slate-700 transition-colors px-4 py-2 rounded-lg text-xs font-medium">
                          Select Image
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setNewDoc({ ...newDoc, profile_image_url: event.target.result.toString() });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <LiquidButton type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Register Doctor</LiquidButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Doctor Modal */}
      <AnimatePresence>
        {showEditDocModal && editingDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-elevated"
            >
              <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 flex items-center"><Stethoscope className="w-5 h-5 mr-2 text-blue-600" /> Edit Provider</h3>
                <LiquidButton onClick={() => setShowEditDocModal(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></LiquidButton>
              </div>
              <form onSubmit={handleUpdateDoctor} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div><label className="text-xs text-slate-500 mb-1 block">Full Name</label><input type="text" required value={editingDoctor.full_name} onChange={e=>setEditingDoctor({...editingDoctor, full_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">License No</label><input type="text" required value={editingDoctor.license_number} onChange={e=>setEditingDoctor({...editingDoctor, license_number: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Room Number</label><input type="text" value={editingDoctor.room_number || ''} onChange={e=>setEditingDoctor({...editingDoctor, room_number: e.target.value})} placeholder="e.g. 101" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">Username</label><input type="text" required value={editingDoctor.username || ''} onChange={e=>setEditingDoctor({...editingDoctor, username: e.target.value})} placeholder="Doctor Username" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Password</label><input type="password" required value={editingDoctor.password || ''} onChange={e=>setEditingDoctor({...editingDoctor, password: e.target.value})} placeholder="Secure Password" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 mb-1 block">Department</label>
                    <select required value={editingDoctor.dept_id} onChange={e=>setEditingDoctor({...editingDoctor, dept_id: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900">
                      <option value="">Select Dept</option>
                      {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-slate-500 mb-1 block">Max Daily Patients</label><input type="number" required value={editingDoctor.max_daily_patients} onChange={e=>setEditingDoctor({...editingDoctor, max_daily_patients: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900" /></div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Status</label>
                  <select required value={editingDoctor.status || 'Active'} onChange={e=>setEditingDoctor({...editingDoctor, status: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                
                <div className="pt-2">
                  <label className="text-xs text-slate-500 mb-2 block">Update Profile Image (Optional)</label>
                  <div 
                    className="border-2 border-dashed border-slate-300 hover:border-blue-200/50 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 transition-colors relative group"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-200', 'bg-blue-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-200', 'bg-blue-50'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-200', 'bg-blue-50');
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith('image/')) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setEditingDoctor({...editingDoctor, profile_image_url: ev.target?.result as string});
                          reader.readAsDataURL(file);
                        }
                      }
                    }}
                  >
                    {editingDoctor.profile_image_url ? (
                      <div className="relative w-full flex justify-center">
                        <img src={editingDoctor.profile_image_url} alt="Preview" className="h-20 w-20 rounded-full object-cover border-2 border-blue-200/30" />
                        <LiquidButton 
                          type="button" 
                          onClick={() => setEditingDoctor({...editingDoctor, profile_image_url: ''})} 
                          className="absolute -top-2 -right-2 md:right-1/4 bg-red-600 text-white rounded-full p-1 hover:bg-red-500 shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </LiquidButton>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-blue-600 transition-colors" />
                        <label className="cursor-pointer bg-white hover:bg-slate-100 border border-slate-300 hover:border-blue-200/50 text-slate-700 transition-colors px-4 py-2 rounded-lg text-xs font-medium">
                          Select New Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setEditingDoctor({...editingDoctor, profile_image_url: ev.target?.result as string});
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
                <LiquidButton type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Save Changes</LiquidButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LogoutDialog 
        isOpen={showLogoutDialog} 
        onClose={() => setShowLogoutDialog(false)} 
        onConfirm={() => {
          setShowLogoutDialog(false);
          handleLogout();
        }} 
      />
    </div>
  );
};
