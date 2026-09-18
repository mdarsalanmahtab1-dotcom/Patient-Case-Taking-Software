import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../config';
import { ArrowLeft, Save, FileText, CheckCircle, Activity, HeartPulse, LogOut, Loader2, User } from 'lucide-react';
import { motion } from 'framer-motion';

export const DoctorDashboard: React.FC = () => {
  const { session_id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [prescription, setPrescription] = useState('');
  const [action, setAction] = useState('Prescribe Meds');
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch patient data from triage queue first
    fetch(`${getApiBaseUrl()}/api/triage/queue`)
      .then(res => res.json())
      .then(async data => {
        const q = data.queue || data || [];
        const p = q.find((x: any) => x.session_id === session_id);
        if (p) {
          setPatient(p);
        } else {
          // If not in queue, fetch directly (might be completed or just not in triage queue)
          const res = await fetch(`${getApiBaseUrl()}/api/session/${session_id}`);
          if (res.ok) {
            const data = await res.json();
            setPatient(data);
          } else {
            setError('Encounter not found or already completed.');
          }
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load encounter.');
      });
  }, [session_id]);

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/session/${session_id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_prescription: prescription || 'No notes provided',
          action: action
        })
      });
      
      if (res.ok) {
        // Pop open the unified AI + Doctor prescription PDF with a cache buster
        window.open(`${getApiBaseUrl()}/api/summary/${session_id}/pdf?t=${Date.now()}`, '_blank');
      }
      
      navigate('/doctor'); // back to queue
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  if (error) return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 bg-slate-50 font-sans">
      <div className="bg-white shadow-card border border-slate-200 rounded-3xl p-8 flex flex-col items-center max-w-md text-center">
        <div className="text-red-500 text-xl font-bold mb-4">{error}</div>
        <LiquidButton onClick={() => navigate('/doctor')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition">
          Back to Queue
        </LiquidButton>
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen w-full flex items-center justify-center p-8 bg-slate-50 font-sans">
      <div className="bg-white shadow-card border border-slate-200 rounded-2xl p-8 text-slate-600 text-base font-medium flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        Loading Encounter...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full font-sans flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 overflow-y-auto scroll-smooth p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6"
        >
        
        {/* Left Column: Patient Context */}
        <div className="md:w-1/3 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <LiquidButton onClick={() => navigate('/doctor')} className="bg-white shadow-card hover:shadow-card-hover text-slate-600 hover:text-slate-900 font-bold px-4 py-2 rounded-xl transition border border-slate-200 flex items-center text-xs">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Queue
            </LiquidButton>
            <LiquidButton 
              onClick={() => setShowLogoutDialog(true)} 
              className="bg-white shadow-card hover:shadow-card-hover text-red-600 hover:text-red-700 font-bold px-4 py-2 rounded-xl transition ml-auto border border-slate-200 flex items-center text-xs"
            >
              <LogOut className="w-4 h-4 mr-2" /> Exit
            </LiquidButton>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="bg-white shadow-card border border-slate-200 rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{patient.full_name}</h2>
                <div className="text-xs font-semibold text-slate-500">
                  Age: {patient.age} • {patient.gender} • Token: <span className="text-blue-600 font-black">{patient.token_id || patient.token_number}</span>
                </div>
              </div>
            </div>

            {!!patient.priority_flag && (
              <div className="mb-4 inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-extrabold border border-red-200 animate-pulse">
                HIGH PRIORITY
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-blue-600"/> Chief Complaint</h3>
                <p className="text-slate-800 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl font-medium text-sm leading-relaxed">{patient.chief_complaint || 'N/A'}</p>
              </div>
              
              {patient.nurse_triage_notes && (
                <div>
                  <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5"><HeartPulse className="w-3.5 h-3.5 text-amber-600"/> Nurse Triage Notes</h3>
                  <p className="text-amber-900 bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl font-medium text-sm leading-relaxed">{patient.nurse_triage_notes}</p>
                </div>
              )}
            </div>

            <LiquidButton 
              onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${patient.session_id}/pdf`, '_blank')}
              className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition border border-slate-200 flex items-center justify-center text-xs"
            >
              <FileText className="w-4 h-4 mr-2" /> View Full AI Summary
            </LiquidButton>
          </motion.div>
        </div>

        {/* Right Column: Doctor Workspace */}
        <div className="md:w-2/3 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="bg-white shadow-card border border-slate-200 rounded-3xl p-6 flex-1 flex flex-col"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <CheckCircle className="w-5 h-5 text-blue-600 mr-2" /> Clinical Encounter
            </h2>
            
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Disposition / Action</label>
                <div className="flex flex-wrap gap-2">
                  {['Prescribe Meds', 'Order Labs', 'Admit Patient', 'Refer to Specialist', 'Discharge'].map(act => (
                    <button
                      key={act}
                      onClick={() => setAction(act)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border active:scale-[0.97] cursor-pointer ${
                        action === act 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/30' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-card'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col mt-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prescription & Notes</label>
                <textarea
                  className="flex-1 w-full bg-slate-50/60 border border-slate-200 rounded-2xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-[border-color,box-shadow] resize-none min-h-[220px] font-medium text-sm leading-relaxed"
                  placeholder="Enter final diagnosis, prescription, and follow-up instructions..."
                  value={prescription}
                  onChange={e => setPrescription(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
              <LiquidButton
                onClick={handleComplete}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-8 rounded-2xl transition flex items-center shadow-card text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating & Signing PDF...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Sign & Complete Encounter
                  </>
                )}
              </LiquidButton>
            </div>
          </motion.div>
        </div>

        </motion.div>
      </div>
      <LogoutDialog 
        isOpen={showLogoutDialog} 
        onClose={() => setShowLogoutDialog(false)} 
        onConfirm={() => {
          setShowLogoutDialog(false);
          localStorage.removeItem('swasthya_doctor_auth');
          navigate('/');
        }} 
      />
    </div>
  );
};
