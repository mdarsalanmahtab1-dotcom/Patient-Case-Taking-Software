import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MonitorSmartphone, ActivitySquare, Stethoscope, ShieldCheck, ExternalLink, Lock, Scale,
  Mail, Phone, MapPin, ArrowRight, Mic, FileSearch, Siren, ClipboardCheck, ChevronDown, Smartphone,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import logoPNG from '../assets/logoPNG.png';
import { getApiBaseUrl } from '../config';

const PORTAL_URL = 'https://swasthyasync-patient-portal.vercel.app/login';

type BackendStatus = 'checking' | 'online' | 'offline';

/** Pings the backend's /health endpoint so the header shows the real connection state. */
function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');
  useEffect(() => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    fetch(`${getApiBaseUrl()}/health`, { signal: ctrl.signal })
      .then(r => setStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setStatus('offline'))
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); ctrl.abort(); };
  }, []);
  return status;
}

// The four screens in the order a patient's visit flows through them.
const JOURNEY = [
  {
    role: 'Patient',
    title: 'Intake kiosk',
    description: 'Voice-guided history in Hindi, Bengali or English, ABHA lookup, and scanning of old prescriptions.',
    icon: MonitorSmartphone,
    tint: 'bg-emerald-50 text-emerald-700',
    path: '/kiosk/login',
    primary: true,
  },
  {
    role: 'Triage nurse',
    title: 'Triage queue',
    description: 'Live queue sorted by acuity. Red-flag symptoms jump to the top the moment they are reported.',
    icon: ActivitySquare,
    tint: 'bg-rose-50 text-rose-700',
    path: '/dashboard/triage',
    primary: false,
  },
  {
    role: 'Doctor',
    title: 'Encounter view',
    description: 'A structured summary of the history and the scanned reports, ready before the patient walks in.',
    icon: Stethoscope,
    tint: 'bg-cyan-50 text-cyan-700',
    path: '/doctor',
    primary: false,
  },
  {
    role: 'Hospital admin',
    title: 'Operations',
    description: 'Doctor rosters, departments, clinical rules and footfall analytics for the OPD.',
    icon: ShieldCheck,
    tint: 'bg-purple-50 text-purple-700',
    path: '/admin',
    primary: false,
  },
];

const HOW_IT_WORKS = [
  { icon: Mic, title: 'Patient talks to the kiosk', desc: 'Questions adapt to the main complaint, in the patient’s language.' },
  { icon: FileSearch, title: 'Old records are read', desc: 'Prescriptions and lab reports become structured medicines, tests and diagnoses.' },
  { icon: Siren, title: 'Danger signs are flagged', desc: 'Symptoms like severe chest pain alert the triage nurse straight away.' },
  { icon: ClipboardCheck, title: 'Doctor gets the summary', desc: 'History arrives in standard clinical terms, so the consult starts informed.' },
];

export const DemoSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackendStatus();

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoPNG} alt="" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-lg font-bold tracking-tight text-slate-900">SwasthyaSync</p>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">OPD intake &amp; triage · SIH prototype</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
                backend === 'online'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : backend === 'offline'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${backend === 'online' ? 'bg-emerald-500' : backend === 'offline' ? 'bg-red-500' : 'bg-slate-400'}`} aria-hidden="true" />
              {backend === 'online' ? 'Backend connected' : backend === 'offline' ? 'Backend offline' : 'Checking backend…'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/kiosk/login')}
              className="tap hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Open kiosk <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
        {/* ── Intro + journey ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl text-balance">
              One OPD visit, followed across four screens
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              SwasthyaSync takes the patient's history at a kiosk before the consult, flags emergencies to the nurse,
              and hands the doctor a ready summary. Open each screen in order to follow one patient through.
            </p>
          </div>

          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.path} className="relative">
                  <button
                    type="button"
                    onClick={() => navigate(step.path)}
                    className={`group flex h-full w-full flex-col items-start gap-4 rounded-2xl border-2 bg-white p-5 text-left shadow-card transition-[border-color,box-shadow] duration-150 hover:shadow-card-hover cursor-pointer ${
                      step.primary ? 'border-blue-600' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${step.tint}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium text-slate-500">Step {i + 1} · {step.role}</span>
                    </span>
                    <span>
                      <span className="block text-lg font-bold text-slate-900">{step.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-slate-600">{step.description}</span>
                    </span>
                    <span className={`mt-auto inline-flex items-center gap-1.5 text-sm font-semibold ${step.primary ? 'text-blue-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                      Open {step.title.toLowerCase()}
                      <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </button>
                  {i < JOURNEY.length - 1 && (
                    <ArrowRight className="absolute -right-3.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-slate-50 text-slate-400 lg:block" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Patient portal */}
          <div className="mt-4 flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row">
            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2">
              <QRCode value={PORTAL_URL} size={88} />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="flex items-center justify-center gap-2 text-base font-bold text-slate-900 sm:justify-start">
                <Smartphone className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Patient mobile portal
              </p>
              <p className="mt-1 text-sm text-slate-600">
                After the kiosk, patients follow their queue token on their phone, read their visit history and ask questions about their prescriptions.
                Scan the code, or open it in this browser.
              </p>
            </div>
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tap inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Open portal <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* ── How it works + compliance ───────────────────────────────── */}
        <section id="guide" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">How it works</h2>
            <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-slate-900">{i + 1}. {s.title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{s.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-slate-900"><Lock className="h-4 w-4 text-blue-600" aria-hidden="true" />DPDP Act 2023</p>
                <p className="mt-1 text-sm text-slate-600">Consent is recorded on the kiosk before any history is taken.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />ABDM / ABHA</p>
                <p className="mt-1 text-sm text-slate-600">Patients can sign in with their 14-digit ABHA number to pull their profile.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-slate-900"><Scale className="h-4 w-4 text-slate-600" aria-hidden="true" />Decision support only</p>
                <p className="mt-1 text-sm text-slate-600">The registered practitioner keeps full diagnostic and prescribing authority.</p>
              </div>
            </div>

            <details className="group mt-6 rounded-xl border border-slate-200">
              <summary className="tap flex cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-semibold text-slate-800">
                Read the full privacy and terms of use
                <ChevronDown className="h-5 w-5 text-slate-500 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div id="terms" className="grid grid-cols-1 gap-6 border-t border-slate-200 px-4 py-5 text-sm leading-relaxed text-slate-600 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-base font-semibold text-slate-900">Privacy and data security</h3>
                  <p className="mb-2">
                    SwasthyaSync is built to comply with the <strong className="text-slate-800">Digital Personal Data Protection (DPDP) Act, 2023</strong> and
                    the <strong className="text-slate-800">Ayushman Bharat Digital Mission (ABDM)</strong> guidelines.
                  </p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>Patient identifiers are anonymised during language-model processing.</li>
                    <li>Data is encrypted at rest (AES-256) and in transit (TLS 1.3).</li>
                    <li>Patient consent is recorded before a session starts.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-base font-semibold text-slate-900">Terms of use</h3>
                  <p>
                    This system is a <strong className="text-slate-800">Clinical Decision Support System (CDSS)</strong>. It assists, and does not replace,
                    professional medical judgement. Final diagnostic and prescriptive authority remains with the registered medical practitioner.
                    AI suggestions are probabilistic and must be checked by the attending physician before treatment.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
            <div>
              <div className="flex items-center gap-2.5">
                <img src={logoPNG} alt="" className="h-8 w-8 object-contain" />
                <span className="text-base font-bold text-slate-900">SwasthyaSync</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">Voice-first OPD intake, real-time triage and clinical decision support for Indian public hospitals.</p>
            </div>
            <nav aria-label="Screens">
              <p className="text-sm font-semibold text-slate-900">Screens</p>
              <ul className="mt-3 space-y-2 text-sm">
                {JOURNEY.map(s => (
                  <li key={s.path}><a href={s.path} className="text-slate-600 hover:text-blue-700">{s.title}</a></li>
                ))}
                <li><a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-blue-700">Patient mobile portal</a></li>
              </ul>
            </nav>
            <address className="not-italic">
              <p className="text-sm font-semibold text-slate-900">Contact</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />Kolkata, India 700039</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />+91 9088260058</li>
                <li className="flex items-center gap-2 min-w-0"><Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="break-all">mdzeeshan08886@gmail.com</span></li>
              </ul>
            </address>
          </div>
          <div className="border-t border-slate-200">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
              <p>© {new Date().getFullYear()} SwasthyaSync · Built for Smart India Hackathon</p>
              <a href="#guide" className="hover:text-blue-700">Privacy and terms of use</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
