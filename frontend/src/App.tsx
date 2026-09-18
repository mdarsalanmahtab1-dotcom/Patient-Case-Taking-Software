import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useConversation } from './hooks/useConversation';
import { Layout } from './components/Layout';
import { Login } from './screens/Login';
import { Screen2_AuthConsent } from './screens/Screen2_AuthConsent';
import { Screen3_ConversationalIntake } from './screens/Screen3_ConversationalIntake';
import { Screen5_DocumentScanner } from './screens/Screen5_DocumentScanner';
import { Screen6_DigitizationVerification } from './screens/Screen6_DigitizationVerification';
import { Screen7_TriageAlert } from './screens/Screen7_TriageAlert';
import { Screen8_Complete } from './screens/Screen8_Complete';
import { DemoSwitcher } from './screens/DemoSwitcher';
import Dashboard_Triage from './screens/Dashboard_Triage';
import { DoctorQueue } from './screens/DoctorQueue';
import { DoctorDashboard } from './screens/DoctorDashboard';
import { AdminPanel } from './screens/AdminPanel';
import { getApiBaseUrl } from './config';
import { AudioGuideProvider } from './context/AudioGuideContext';

const API_BASE_URL = getApiBaseUrl();

// Route Sync Component
function RouteSynchronizer({ ui, pendingSession }: { ui: any, pendingSession: any }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let expectedRoute = '/kiosk/login';

    if (!ui) {
      expectedRoute = pendingSession ? '/kiosk/demographics' : '/kiosk/login';
    } else {
      switch (ui.screen) {
        case 'welcome':
          expectedRoute = '/kiosk/login';
          break;
        case 'demographics':
          expectedRoute = '/kiosk/demographics';
          break;
        case 'conversation':
          expectedRoute = '/kiosk/interview';
          break;
        case 'schema_generating':
          expectedRoute = '/kiosk/interview'; // Loading state handles this
          break;
        case 'document_scan':
          expectedRoute = '/kiosk/upload';
          break;
        case 'summary':
          expectedRoute = '/kiosk/review';
          break;
        case 'complete':
          expectedRoute = '/kiosk/complete';
          break;
        case 'triage_alert':
          expectedRoute = '/kiosk/triage';
          break;
        default:
          expectedRoute = '/kiosk/login';
      }
    }

    if (location.pathname !== expectedRoute) {
      navigate(expectedRoute, { replace: true });
    }
  }, [ui, pendingSession, location.pathname, navigate]);

  return null;
}

const pageVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98
  }),
  in: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 }
  },
  out: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 }
  })
};

function AnimatedRoute({ children, routeKey, direction, isKiosk = false }: any) {
  return (
    <motion.div
      key={routeKey}
      custom={direction}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={isKiosk ? "flex flex-col w-full grow min-h-full" : "w-full min-h-screen"}
    >
      {children}
    </motion.div>
  );
}

function KioskApp() {
  const {
    ui,
    orbState,
    isConnected,
    isProcessing,
    startSession,
    resumeSession,
    sendInput,
    sendRedflag,
    clearRedflag,
  } = useConversation();

  const [pendingSession, setPendingSession] = useState<{
    clinicMode: string;
    language: string;
    patientId?: string;
  } | null>(null);

  const [direction, setDirection] = useState(1);
  const location = useLocation();

  useEffect(() => {
    if (isConnected && !ui) {
      const storedSessionId = sessionStorage.getItem('swasthyasync_session');
      if (storedSessionId) {
        resumeSession(storedSessionId);
      }
    }
  }, [isConnected, ui, resumeSession]);

  const isInterview = location.pathname.includes('/kiosk/interview') || ui?.screen === 'conversation' || ui?.screen === 'schema_generating';

  return (
    <AudioGuideProvider>
      <Layout isConnected={isConnected} isKioskInterview={isInterview}>
        <RouteSynchronizer ui={ui} pendingSession={pendingSession} />
      
      <div className="relative w-full grow flex flex-col h-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <Routes location={location} key={location.pathname}>
            
            <Route path="/kiosk/login" element={
              <AnimatedRoute routeKey="welcome" direction={direction} isKiosk={true}>
                <Login
                  onSessionStarted={(sessionData: any, patientData: any, language: string) => {
                    setDirection(1);
                    sessionStorage.setItem('swasthyasync_session', sessionData.session_id);
                    startSession(
                      patientData.department || 'allopathic', 
                      language, 
                      { 
                        name: patientData.full_name, 
                        age: patientData.age, 
                        sex: patientData.gender,
                        weight: patientData.weight,
                        height: patientData.height,
                        vitals: patientData.vitals
                      }, 
                      patientData.patient_id, 
                      sessionData.session_id
                    );
                  }}
                  isConnected={isConnected}
                />
              </AnimatedRoute>
            } />

            <Route path="/kiosk/demographics" element={
              <AnimatedRoute routeKey="demographics" direction={direction} isKiosk={true}>
                <Screen2_AuthConsent
                  language={pendingSession?.language || 'en-IN'}
                  onNext={async (demographics) => {
                    setDirection(1);
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/session/start`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ patient_id: pendingSession?.patientId })
                      });
                      if (res.ok) {
                        const sessionData = await res.json();
                        sessionStorage.setItem('swasthyasync_session', sessionData.session_id);
                        startSession(
                          pendingSession?.clinicMode || 'allopathic',
                          pendingSession?.language || 'en-IN',
                          demographics,
                          pendingSession?.patientId || undefined,
                          sessionData.session_id
                        );
                      } else {
                        alert("Failed to start session from backend");
                      }
                    } catch(e) {
                      console.error(e);
                      alert("Failed to start session");
                    }
                  }}
                  onBack={() => {
                    setDirection(-1);
                    if (ui) sendInput('back', '');
                    else setPendingSession(null);
                  }}
                />
              </AnimatedRoute>
            } />

            <Route path="/kiosk/interview" element={
              <AnimatedRoute routeKey="interview" direction={direction} isKiosk={true}>
                {ui?.screen === 'schema_generating' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Preparing Your Interview</h2>
                    <p className="text-slate-500 max-w-sm">
                      Generating a clinical questionnaire tailored specifically to your complaint...
                    </p>
                  </div>
                ) : (
                  <Screen3_ConversationalIntake
                    ui={ui!}
                    orbState={orbState}
                    isProcessing={isProcessing}
                    onTap={(value: string) => sendInput('tap', value)}
                    onVoice={(transcript: string) => sendInput('voice', transcript)}
                    onSkip={() => sendInput('skip', '')}
                    onBack={() => {
                      setDirection(-1);
                      sendInput('back', '');
                    }}
                    onRedflag={() => sendRedflag()}
                  />
                )}
              </AnimatedRoute>
            } />

            <Route path="/kiosk/upload" element={
              <AnimatedRoute routeKey="upload" direction={direction} isKiosk={true}>
                <Screen5_DocumentScanner
                  language={ui?.language || pendingSession?.language || 'en-IN'}
                  onNext={async (files: File[]) => {
                    setDirection(1);
                    if (files && files.length > 0 && ui?.session_id) {
                      const formData = new FormData();
                      files.forEach(file => {
                        formData.append('files', file);
                      });
                      formData.append('session_id', ui.session_id);
                      formData.append('patient_name', ui?.patient_name || ui?.patient_record?.patient_name || 'Unknown Patient');
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/ocr/batch`, {
                          method: 'POST',
                          body: formData,
                        });
                        const data = await response.json();
                        if (data.status === 'rejected') {
                          throw new Error(`Verification Failed: ${data.reason || 'Document mismatch. Please verify and re-upload.'}`);
                        }
                      } catch (e: any) {
                        console.error("OCR upload failed", e);
                        throw e; // Propagate to Screen5
                      }
                    }
                    sendInput('next', '');
                  }}
                  onSkip={() => {
                    setDirection(1);
                    sendInput('skip', '');
                  }}
                />
              </AnimatedRoute>
            } />

            <Route path="/kiosk/review" element={
              <AnimatedRoute routeKey="review" direction={direction} isKiosk={true}>
                <Screen6_DigitizationVerification
                  patientRecord={ui?.patient_record}
                  sessionId={ui?.session_id}
                  language={ui?.language || pendingSession?.language || 'en-IN'}
                  onNext={() => {
                    setDirection(1);
                    sendInput('next', '');
                  }}
                  onBack={() => {
                    setDirection(-1);
                    sendInput('back', '');
                  }}
                />
              </AnimatedRoute>
            } />

            <Route path="/kiosk/triage" element={
              <AnimatedRoute routeKey="triage" direction={direction} isKiosk={true}>
                <Screen7_TriageAlert
                  onResume={() => clearRedflag()}
                  onNewPatient={() => {
                    sessionStorage.removeItem('swasthyasync_session');
                    localStorage.removeItem('kiosk_session_id');
                    window.location.href = '/kiosk/login';
                  }}
                />
              </AnimatedRoute>
            } />

            <Route path="/kiosk/complete" element={
              <AnimatedRoute routeKey="complete" direction={direction} isKiosk={true}>
                <Screen8_Complete 
                  patientRecord={ui?.patient_record} 
                  sessionId={ui?.session_id} 
                  language={ui?.language || pendingSession?.language || 'en-IN'}
                  onReset={() => {
                    sessionStorage.removeItem('swasthyasync_session');
                    localStorage.removeItem('kiosk_session_id');
                    window.location.href = '/kiosk/login';
                  }} 
                />
              </AnimatedRoute>
            } />

            <Route path="*" element={<Navigate to="/kiosk/login" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      </Layout>
    </AudioGuideProvider>
  );
}

function App() {
  const location = useLocation();

  if (location.pathname === '/') return <DemoSwitcher />;
  if (location.pathname.startsWith('/dashboard/triage')) return <Dashboard_Triage />;
  if (location.pathname.startsWith('/doctor/encounter/')) return (
    <Routes>
      <Route path="/doctor/encounter/:session_id" element={<DoctorDashboard />} />
    </Routes>
  );
  if (location.pathname.startsWith('/doctor')) return <DoctorQueue />;
  if (location.pathname.startsWith('/admin')) return <AdminPanel />;

  return <KioskApp />;
}

export default App;
