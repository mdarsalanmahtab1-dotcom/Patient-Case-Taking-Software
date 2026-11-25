import { LiquidButton } from '../components/ui/button';
import { LogoutDialog } from '../components/LogoutDialog';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../config';
import { ArrowLeft, FileText, CheckCircle, Activity, HeartPulse, LogOut, Loader2, User, Download } from 'lucide-react';

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
        // Mark session as IN_PROGRESS if it was WAITING
        fetch(`${getApiBaseUrl()}/api/session/${session_id}/start`, { method: 'POST' }).catch(() => {});
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
        const data = await res.json().catch(() => ({}));
        const downloadUrl = `${getApiBaseUrl()}/api/summary/${session_id}/pdf?download=true&regenerate=true&t=${Date.now()}`;
        const previewUrl = data.pdf_url && data.pdf_url.startsWith('http')
          ? data.pdf_url
          : `${getApiBaseUrl()}/api/summary/${session_id}/pdf?regenerate=true&t=${Date.now()}`;

        const rawToken = patient?.token_number || patient?.token_id || session_id || 'Encounter';
        const filename = `OPD_Casesheet_${String(rawToken).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

        // 1. Direct file download via blob fetch
        try {
          const fileResp = await fetch(downloadUrl);
          if (fileResp.ok) {
            const blob = await fileResp.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
          } else {
            throw new Error('Direct blob fetch returned error');
          }
        } catch (fetchErr) {
          console.warn('Blob download error, falling back to direct anchor download:', fetchErr);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // 2. Also open preview window/tab
        try {
          window.open(previewUrl, '_blank');
        } catch {}

        // Small delay to allow the browser to initiate the download stream before page navigation
        await new Promise(r => setTimeout(r, 600));
      }
      
      navigate('/doctor'); // back to queue
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  if (error) return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 bg-slate-50 font-sans">
      <div className="bg-white shadow-card border border-slate-200 rounded-2xl p-8 flex flex-col items-center max-w-md text-center">
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

  const priority = !!patient.priority_flag;
  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-slate-50">
      {/* Sticky patient strip: who this is and what matters most, always visible */}
      <header className={`shrink-0 border-b bg-white ${priority ? 'border-red-200' : 'border-slate-200'}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => navigate('/doctor')} className="tap inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Queue
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><User className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{patient.full_name}</h1>
              <p className="text-sm text-slate-600">
                {[patient.age && `${patient.age} y`, patient.gender, `Token ${patient.token_id || patient.token_number || '–'}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            {priority && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
                <HeartPulse className="h-4 w-4" aria-hidden="true" /> High priority
              </span>
            )}
          </div>
          <button type="button" onClick={() => setShowLogoutDialog(true)} className="tap inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
        <div className={`border-t ${priority ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-base sm:px-6">
            <Activity className={`mt-1 h-4 w-4 shrink-0 ${priority ? 'text-red-700' : 'text-blue-600'}`} aria-hidden="true" />
            <span><span className="font-semibold text-slate-900">Chief complaint:</span> <span className="text-slate-800">{patient.chief_complaint || 'Not recorded'}</span></span>
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_1.8fr]">
          <aside className="space-y-4">
            {patient.nurse_triage_notes && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800"><HeartPulse className="h-4 w-4" aria-hidden="true" /> Nurse triage notes</h2>
                <p className="text-base leading-relaxed text-amber-900">{patient.nurse_triage_notes}</p>
              </section>
            )}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <h2 className="text-sm font-semibold text-slate-700">Full intake summary</h2>
              <p className="mt-1 text-sm text-slate-600">History, answers and scanned reports from the kiosk, as a printable casesheet.</p>
              <button
                type="button"
                onClick={() => window.open(`${getApiBaseUrl()}/api/summary/${patient.session_id}/pdf`, '_blank')}
                className="tap mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="h-4 w-4" aria-hidden="true" /> Open summary (PDF)
              </button>
            </section>
          </aside>

          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="enc-title">
            <h2 id="enc-title" className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CheckCircle className="h-5 w-5 text-blue-600" aria-hidden="true" /> Consultation
            </h2>

            <div className="mt-5">
              <p id="disp-label" className="mb-2 text-sm font-semibold text-slate-700">Disposition</p>
              <div role="radiogroup" aria-labelledby="disp-label" className="flex flex-wrap gap-2">
                {['Prescribe Meds', 'Order Labs', 'Admit Patient', 'Refer to Specialist', 'Discharge'].map(act => (
                  <button
                    key={act}
                    type="button"
                    role="radio"
                    aria-checked={action === act}
                    onClick={() => setAction(act)}
                    className={`tap rounded-lg border px-3 text-sm font-semibold cursor-pointer ${
                      action === act ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-1 flex-col">
              <label htmlFor="enc-notes" className="mb-2 text-sm font-semibold text-slate-700">Diagnosis, prescription and follow-up</label>
              <textarea
                id="enc-notes"
                className="min-h-[240px] w-full flex-1 resize-none rounded-lg border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                placeholder="Final diagnosis, medicines with dose and duration, tests ordered, and when to come back…"
                value={prescription}
                onChange={e => setPrescription(e.target.value)}
              />
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSaving}
                className="h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {isSaving
                  ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Signing and preparing PDF…</>
                  : <><Download className="h-5 w-5" aria-hidden="true" /> Sign and download casesheet</>}
              </button>
            </div>
          </section>
        </div>
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
