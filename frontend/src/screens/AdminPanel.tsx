import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import { AnalyticsDashboard, RedFlagFeed } from './AnalyticsDashboard';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Lock, Mail, Key, ArrowRight, Plus, LogOut, Calendar, UploadCloud, FileText,
  Activity, Users, LayoutList, Stethoscope, Settings, List, AlertTriangle, X, Search, DownloadCloud, TrendingUp, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = 'http://localhost:8000/api/admin';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      localStorage.setItem('swasthya_admin_auth', 'true');
      setAuthError('');
      fetchAllData();
    } else {
      setAuthError('Invalid admin credentials. Access denied.');
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
      fetch(`http://localhost:8000/api/admin/notifications`)
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
    await fetch(`http://localhost:8000/api/admin/notifications/${notif_id}/read`, { method: 'PUT' });
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
        alert(`Failed to add doctor: ${errorData.detail || res.statusText}`);
        return;
      }
      setNewDoc({ full_name: '', dept_id: '', license_number: '', profile_image_url: '', max_daily_patients: 40, room_number: '', username: '', password: '' });
      setShowAddDocModal(false);
      fetchAllData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
        alert(`Failed to update doctor: ${errorData.detail || res.statusText}`);
        return;
      }
      setShowEditDocModal(false);
      fetchAllData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
      <div className="h-screen w-full bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-elevated overflow-hidden"
        >
          <div className="bg-purple-50 p-6 border-b border-purple-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-3 shadow-sm">
              <Lock className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">System Administration</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Sign in with administrative privileges</p>
          </div>
          <form onSubmit={handleLogin} className="p-6 space-y-5">
            {authError && <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-red-600 text-xs font-bold text-center">{authError}</div>}
            <div className="relative">
              <Mail className="absolute inset-y-3.5 left-4 h-4 w-4 text-slate-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium" placeholder="Admin Email" />
            </div>
            <div className="relative">
              <Key className="absolute inset-y-3.5 left-4 h-4 w-4 text-slate-400" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium" placeholder="Password" />
            </div>
            <LiquidButton type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex justify-center items-center text-sm shadow-md active:scale-[0.97]">Authenticate <ArrowRight className="ml-2 w-4 h-4" /></LiquidButton>
            <LiquidButton type="button" onClick={() => navigate('/')} className="w-full py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl text-sm active:scale-[0.97]">Cancel & Return</LiquidButton>
          </form>
        </motion.div>
      </div>
    );
  }

  const filteredQueues = selectedDeptFilter === 'ALL' 
    ? queues 
    : queues.filter(q => q.department === selectedDeptFilter);
    
  const priorityQueues = filteredQueues.filter(q => q.priority_flag);
  const normalQueues = filteredQueues.filter(q => !q.priority_flag);

  const tabs = [
    { id: 'analytics', icon: TrendingUp, label: 'Analytics Dashboard', color: 'text-blue-600' },
    { id: 'red_flags', icon: ShieldAlert, label: 'Live Red Flags', color: 'text-red-500' },
    { id: 'live_queue', icon: Activity, label: 'Live Queue Control', color: 'text-blue-600' },
    { id: 'departments', icon: LayoutList, label: 'Department Manager', color: 'text-emerald-600' },
    { id: 'doctors', icon: Stethoscope, label: 'Doctor Roster', color: 'text-blue-600' },
    { id: 'patients', icon: Users, label: 'Patient Master View', color: 'text-emerald-600' },
    { id: 'rules', icon: Settings, label: 'Clinical Rules', color: 'text-purple-600' },
    { id: 'logs', icon: List, label: 'Audit Ledger', color: 'text-slate-500' },
    { id: 'reset', icon: AlertTriangle, label: 'End of Day Reset', color: 'text-red-600' },
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
      alert('Failed to download DB');
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 font-sans p-6 flex flex-col overflow-hidden">
      <header className="flex-none flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-50 border border-purple-200/30 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Administration</h1>
            <p className="text-[#8b949e] text-sm flex items-center mt-1">
              <Calendar className="w-4 h-4 mr-1.5 text-blue-600" /> {todayDate}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <LiquidButton 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-700 transition relative"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">
                  {notifications.length}
                </span>
              )}
            </LiquidButton>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-300">
                  <h3 className="font-bold text-slate-900 text-sm">Doctor Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">No new notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.notif_id} className="p-4 border-b border-slate-200 hover:bg-slate-100/50 transition">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-cyan-400 text-sm">{n.doctor_name}</span>
                          <span className="text-[10px] text-slate-500">{new Date(n.timestamp + 'Z').toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-700 text-xs mb-2">{n.message}</p>
                        <LiquidButton 
                          onClick={() => handleMarkNotificationRead(n.notif_id)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Mark as read
                        </LiquidButton>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-200/30">
            Admin: {ADMIN_EMAIL}
          </span>
          <LiquidButton onClick={handleExportDB} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold transition flex items-center shadow-lg shadow-emerald-600/20 active:scale-95">
            <DownloadCloud className="w-4 h-4 mr-2" /> Download DB
          </LiquidButton>
          <LiquidButton onClick={() => setShowLogoutDialog(true)} className="px-4 py-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-700 transition flex items-center">
            <LogOut className="w-4 h-4 mr-2 text-slate-500" /> Secure Logout
          </LiquidButton>
        </div>
      </header>

      {/* Analytics Row */}
      <div className="flex-none grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-card hover:shadow-card-hover transition-shadow">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Footfall</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{analytics.total_footfall}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-card hover:shadow-card-hover transition-shadow">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Wait Time</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{analytics.avg_wait_time}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-card hover:shadow-card-hover transition-shadow">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Emergencies</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{analytics.emergency_active}</h3>
          </div>
          <div className={`p-3 rounded-xl ${analytics.emergency_active > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
            <AlertTriangle className={`w-6 h-6 ${analytics.emergency_active > 0 ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 bg-white shadow-card border border-slate-200/80 rounded-3xl p-3 flex flex-col h-[calc(100vh-140px)] overflow-y-auto gap-1">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl text-left transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                activeTab === tab.id 
                  ? 'bg-blue-50/80 text-blue-700 font-bold border border-blue-200/60 shadow-sm' 
                  : 'hover:bg-slate-50 text-slate-600 font-medium border border-transparent'
              }`}
            >
              <tab.icon className={`w-4 h-4 mr-2.5 shrink-0 ${activeTab === tab.id ? 'text-blue-600' : tab.color}`} />
              <span className="text-xs truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl overflow-hidden flex flex-col shadow-card">
          <div className="flex-1 overflow-y-auto p-6">
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
                  <LiquidButton type="submit" className="bg-[#00d084] hover:bg-[#00b070] text-black font-bold px-6 py-2 rounded">Add Dept</LiquidButton>
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
                            : 'bg-slate-100 hover:bg-slate-700 text-slate-700'
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
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Header & Action Bar */}
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200/60 shadow-lg">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center">
                    <Stethoscope className="w-6 h-6 mr-3 text-blue-600" />
                    Active Physician Directory
                  </h2>
                  <LiquidButton 
                    onClick={() => setShowAddDocModal(true)}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/30 rounded-xl transition flex items-center font-semibold text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Register Provider
                  </LiquidButton>
                </div>

                {/* Dynamic Database Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {doctors.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-[#8b949e] bg-white border border-slate-200/60 rounded-2xl">
                      No physicians found in the database. Add one to begin.
                    </div>
                  ) : (
                    doctors.map((doc) => (
                      <div 
                        key={doc.doctor_id} 
                        className="bg-white border border-slate-200 hover:border-blue-200/40 rounded-2xl p-6 transition-all duration-300 group shadow-lg"
                      >
                        <div className="flex items-start space-x-4 mb-4">
                          <div className="flex-shrink-0 relative">
                            {doc.profile_image_url ? (
                              <img 
                                src={doc.profile_image_url} 
                                alt={doc.full_name} 
                                className="w-16 h-16 rounded-full object-cover border-2 border-blue-200/30 group-hover:border-blue-200/80 transition-colors" 
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200/30 flex items-center justify-center ${doc.profile_image_url ? 'hidden' : 'flex'}`}>
                              <Stethoscope className="w-7 h-7 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <h3 className="text-lg font-bold text-slate-900 truncate flex items-center gap-2">
                              {doc.full_name}
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${doc.current_status === 'Available' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                {doc.current_status || 'Available'}
                              </span>
                            </h3>
                            <p className="text-sm text-blue-600 font-medium mt-0.5 truncate">{doc.dept_name || `Dept ID: ${doc.dept_id}`}</p>
                            <p className="text-xs text-[#8b949e] mt-1.5 flex items-center">
                              <ShieldCheck className="w-3 h-3 mr-1.5 text-slate-500" /> {doc.license_number}
                              <span className="mx-2">•</span>
                              Room {doc.room_number || 'TBD'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/60">
                          <div className="flex justify-between items-end mb-2">
                            <div className="text-xs">
                              <span className="block text-[#8b949e] mb-0.5">Patients Consulted Today</span>
                              <span className="font-bold text-slate-200 text-sm">
                                {doc.total_seen_today || 0} <span className="text-slate-500 font-normal">/ {doc.max_daily_patients}</span>
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border ${doc.status === 'Active' ? 'bg-[#00d084]/10 text-emerald-600 border-emerald-200/30' : 'bg-red-50 text-red-600 border-red-200/30'}`}>
                              {doc.status || 'Active'}
                            </span>
                          </div>
                          {/* Visual Capacity Bar */}
                          <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden mb-3">
                            <div 
                              className="bg-gradient-to-r from-[#00e5ff] to-[#00d084] h-1.5 rounded-full" 
                              style={{ width: `${Math.min(100, ((doc.total_seen_today || 0) / doc.max_daily_patients) * 100)}%` }}
                            ></div>
                          </div>
                          <LiquidButton 
                            onClick={() => { setEditingDoctor(doc); setShowEditDocModal(true); }}
                            className="w-full text-xs font-semibold py-1.5 bg-slate-100 hover:bg-slate-700 text-blue-600 rounded transition"
                          >
                            Edit Details
                          </LiquidButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-slate-900 focus:border-emerald-200 focus:ring-1 focus:ring-[#00d084]"
                    />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Phone (Family)</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
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
                              <LiquidButton onClick={() => { setEditingPatient(p); setShowEditModal(true); }} className="text-xs bg-slate-100 hover:bg-slate-700 px-3 py-1.5 rounded text-blue-600 font-medium transition">Edit Details</LiquidButton>
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
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/60">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Timestamp</th>
                        <th className="px-6 py-4 font-semibold">Admin Identity</th>
                        <th className="px-6 py-4 font-semibold">Action Triggered</th>
                        <th className="px-6 py-4 font-semibold">Target Object ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[#8b949e]">
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
                <LiquidButton onClick={() => setShowDangerModal(true)} className="bg-[#ff4d4f] hover:bg-red-500 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(255,77,79,0.4)] transition transform hover:scale-105 active:scale-[0.97]">Initialize EOD Reset</LiquidButton>
              </div>
            )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Danger Modal */}
      <AnimatePresence>
        {showDangerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-red-200/50 p-8 rounded-3xl max-w-md w-full shadow-elevated"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Confirm Reset</h3>
              <p className="text-slate-700 mb-6">Are you absolutely sure? This will archive {normalQueues.length + priorityQueues.length} active queues.</p>
              <div className="flex space-x-4">
                <LiquidButton onClick={() => setShowDangerModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl">Cancel</LiquidButton>
                <LiquidButton onClick={handleResetClinic} className="flex-1 py-3 bg-[#ff4d4f] hover:bg-red-500 text-white font-bold rounded-xl">Yes, Reset Now</LiquidButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Patient Modal */}
      <AnimatePresence>
        {showEditModal && editingPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-elevated"
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
                <LiquidButton type="submit" className="w-full py-3 mt-4 bg-[#00d084] hover:bg-[#00b070] text-black font-bold rounded-xl">Save Changes</LiquidButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Doctor Modal */}
      <AnimatePresence>
        {showAddDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-elevated"
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
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-200', 'bg-[#00e5ff]/5'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-200', 'bg-[#00e5ff]/5'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-200', 'bg-[#00e5ff]/5');
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
                          className="absolute -top-2 -right-2 md:right-1/4 bg-[#ff4d4f] text-slate-900 rounded-full p-1 hover:bg-red-500 shadow-lg"
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

                <LiquidButton type="submit" className="w-full mt-4 bg-[#00e5ff] hover:bg-[#00c5dd] text-black font-bold py-3 rounded-xl">Register Doctor</LiquidButton>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Doctor Modal */}
      <AnimatePresence>
        {showEditDocModal && editingDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-elevated"
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
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-200', 'bg-[#00e5ff]/5'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-200', 'bg-[#00e5ff]/5'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-200', 'bg-[#00e5ff]/5');
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
                          className="absolute -top-2 -right-2 md:right-1/4 bg-[#ff4d4f] text-slate-900 rounded-full p-1 hover:bg-red-500 shadow-lg"
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
                <LiquidButton type="submit" className="w-full mt-4 bg-[#00e5ff] hover:bg-[#00c5dd] text-black font-bold py-3 rounded-xl">Save Changes</LiquidButton>
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
