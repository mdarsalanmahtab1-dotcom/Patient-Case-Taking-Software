import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, ActivitySquare, Stethoscope, ShieldCheck, ExternalLink, Wifi, FileText, Lock, Scale, Info, CheckCircle2, Send, Code2, Link2, MessageCircle, Globe, Mail, Phone, MapPin, Heart } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import QRCode from 'react-qr-code';
import logoPNG from '../assets/logoPNG.png';

export const DemoSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll({ container: scrollRef });
  const smoothScrollY = useSpring(scrollY, { stiffness: 200, damping: 28, restDelta: 0.001 });
  const headerPaddingY = useTransform(smoothScrollY, [0, 50], ["0.75rem", "0.5rem"]);
  const headerShadow = useTransform(smoothScrollY, [0, 50], ["0 4px 20px rgba(0,0,0,0.06)", "0 10px 32px rgba(0,0,0,0.12)"]);
  const headerBlur = useTransform(smoothScrollY, [0, 50], ["blur(12px)", "blur(24px)"]);

  const modules = [
    {
      title: "Patient Kiosk",
      description: "Self-service AI intake, family registration, and document OCR.",
      icon: <MonitorSmartphone className="w-7 h-7 text-emerald-500" />,
      path: "/kiosk/login",
      gradient: "from-emerald-500 to-teal-500",
      borderColor: "border-emerald-200",
      iconBg: "bg-emerald-50",
      hoverBorder: "hover:border-emerald-400",
      shadowColor: "hover:shadow-emerald-200/60",
    },
    {
      title: "Triage Nurse Queue",
      description: "Live monitoring, emergency red-flag sorting, and patient flow.",
      icon: <ActivitySquare className="w-7 h-7 text-rose-500" />,
      path: "/dashboard/triage",
      gradient: "from-rose-500 to-pink-500",
      borderColor: "border-rose-200",
      iconBg: "bg-rose-50",
      hoverBorder: "hover:border-rose-400",
      shadowColor: "hover:shadow-rose-200/60",
    },
    {
      title: "Doctor Dashboard",
      description: "View AI summaries, sign casesheets, and review OCR lab data.",
      icon: <Stethoscope className="w-7 h-7 text-cyan-500" />,
      path: "/doctor",
      gradient: "from-cyan-500 to-blue-500",
      borderColor: "border-cyan-200",
      iconBg: "bg-cyan-50",
      hoverBorder: "hover:border-cyan-400",
      shadowColor: "hover:shadow-cyan-200/60",
    },
    {
      title: "Hospital Admin",
      description: "Role-Based Access Control (RBAC), doctor rosters, and staff management.",
      icon: <ShieldCheck className="w-7 h-7 text-purple-500" />,
      path: "/admin",
      gradient: "from-purple-500 to-indigo-500",
      borderColor: "border-purple-200",
      iconBg: "bg-purple-50",
      hoverBorder: "hover:border-purple-400",
      shadowColor: "hover:shadow-purple-200/60",
    },
    {
      title: "Patient Mobile Portal",
      description: "Scan QR code on your phone to access live AI chat and consultation history.",
      icon: <QRCode value="https://swasthyasync-patient-portal.vercel.app/login" size={40} className="rounded-md" />,
      path: "https://swasthyasync-patient-portal.vercel.app/login",
      gradient: "from-orange-500 to-amber-500",
      borderColor: "border-orange-200",
      iconBg: "bg-orange-50",
      hoverBorder: "hover:border-orange-400",
      shadowColor: "hover:shadow-orange-200/60",
      isExternal: true
    }
  ];

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-white flex flex-col overflow-hidden">
      {/* ─── Top Status Bar (matches Layout) ─── */}
      <div className="w-full px-3 sm:px-8 py-1.5 flex items-center justify-between bg-slate-50 border-b border-slate-200 text-[11px] sm:text-xs shadow-xs z-50 relative">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-medium">
          <span className="text-slate-700 font-bold tracking-tight">SwasthyaSync v2.0</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-slate-500 font-medium text-[10px] sm:text-xs">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <Wifi className="w-3 h-3" />
            Connected
          </div>
        </div>
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50">
        {/* Floating Round Header (same as Layout) */}
        <div className="absolute top-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <motion.header
            style={{
              paddingTop: headerPaddingY,
              paddingBottom: headerPaddingY,
              boxShadow: headerShadow,
              backdropFilter: headerBlur,
              WebkitBackdropFilter: headerBlur
            }}
            className="pointer-events-auto w-full max-w-3xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between bg-white border border-slate-100 rounded-full shadow-lg z-10"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center rounded-full overflow-hidden bg-white mr-2 sm:mr-3">
                <img src={logoPNG} alt="SwasthyaSync Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
                <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold tracking-wide uppercase">AI-Powered OPD Presentation</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Demo Mode
              </div>
            </div>
          </motion.header>
        </div>

        {/* ─── Scrollable Content ─── */}
        <main
          ref={scrollRef}
          className="flex-1 relative overflow-y-auto overflow-x-hidden pt-24 sm:pt-28"
          tabIndex={-1}
        >
          {/* Background gradient orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-8 relative z-10">
            {/* Logo + Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center mb-12 flex flex-col items-center"
            >
              <motion.img
                src={logoPNG}
                alt="SwasthyaSync Logo"
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain mb-4 drop-shadow-lg"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 mb-4 pb-1">
                SwasthyaSync OPD
              </h1>
              <p className="text-slate-500 text-sm sm:text-base font-medium max-w-lg mx-auto leading-relaxed">
                Built to drastically reduce OPD wait times and streamline clinical workflows through AI-driven triage and automated history-taking.
              </p>
            </motion.div>

            {/* ─── Module Cards Grid ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12"
            >
              {modules.map((mod, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => {
                    if (mod.isExternal) {
                      window.open(mod.path, '_blank');
                    } else {
                      navigate(mod.path);
                    }
                  }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3, scale: 1.008 }}
                  whileTap={{ scale: 0.97 }}
                  className={`
                    group flex items-start text-left p-5 sm:p-6 rounded-2xl border-2 ${mod.borderColor}
                    bg-white shadow-card
                    transition-[transform,box-shadow,border-color] duration-150 cursor-pointer
                    ${mod.hoverBorder} ${mod.shadowColor} hover:shadow-card-hover
                  `}
                >
                  {/* Icon */}
                  <div className={`p-3.5 rounded-xl mr-4 sm:mr-5 ${mod.iconBg} transition-transform duration-200 group-hover:scale-105 shrink-0`}>
                    {mod.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-slate-800 font-extrabold text-base sm:text-lg mb-1">{mod.title}</h2>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      {mod.description}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                      <span>Open Module</span>
                      <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {/* ─── System Guide & Privacy Terms ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-16 bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-50 px-6 sm:px-10 py-6 border-b border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Platform Guide & Compliance</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Understanding how SwasthyaSync processes patient data.</p>
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                
                {/* How it Works */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-5 h-5 text-teal-600" />
                    <h4 className="text-lg font-bold text-slate-900">How the System Works</h4>
                  </div>
                  <ul className="space-y-5">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700 block text-sm">1. Autonomous AI Intake</span>
                        <span className="text-slate-500 text-xs sm:text-sm leading-relaxed">Patients converse with an empathetic Voice AI at the kiosk, which dynamically asks relevant clinical questions based on their chief complaint.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700 block text-sm">2. OCR & Document Processing</span>
                        <span className="text-slate-500 text-xs sm:text-sm leading-relaxed">Historical prescriptions and lab reports are uploaded and structured instantly using computer vision, extracting past medical history.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700 block text-sm">3. Algorithmic Triage & Red-Flags</span>
                        <span className="text-slate-500 text-xs sm:text-sm leading-relaxed">The system flags critical symptoms (e.g., severe chest pain) alerting the triage nurse queue immediately to prioritize emergency cases.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700 block text-sm">4. Physician Handoff</span>
                        <span className="text-slate-500 text-xs sm:text-sm leading-relaxed">Doctors receive a pre-filled, highly structured clinical summary in standard medical terminology, reducing documentation time by up to 70%.</span>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Privacy & Terms */}
                <div className="space-y-8">
                  {/* Privacy */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <h4 className="text-lg font-bold text-slate-900">Privacy & Data Security</h4>
                    </div>
                    <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100">
                      <p className="text-sm text-slate-600 leading-relaxed mb-3">
                        SwasthyaSync operates under strict compliance with the <strong className="text-slate-800">Digital Personal Data Protection (DPDP) Act, 2023</strong> and adheres to <strong className="text-slate-800">ABDM (Ayushman Bharat Digital Mission)</strong> guidelines.
                      </p>
                      <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 space-y-2 ml-1">
                        <li>All patient identifiers are anonymized during LLM processing.</li>
                        <li>Data is encrypted at rest (AES-256) and in transit (TLS 1.3).</li>
                        <li>Patient consent is explicitly recorded before session initiation.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Terms */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Scale className="w-5 h-5 text-purple-600" />
                      <h4 className="text-lg font-bold text-slate-900">Terms of Use</h4>
                    </div>
                    <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        This system is designed as a <strong className="text-slate-800">Clinical Decision Support System (CDSS)</strong>. It is intended to assist, not replace, professional medical judgment. 
                        Final diagnostic and prescriptive authority remains strictly with the registered medical practitioner. The AI suggestions are probabilistic and must be independently verified by the attending physician before rendering treatment.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>

          {/* ─── Premium Footer ─── */}
          <footer className="relative w-full bg-slate-900 text-slate-300 overflow-hidden">
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
              <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">

                {/* Col 1 — Brand + Newsletter */}
                <div className="relative lg:col-span-1">
                  <div className="flex items-center gap-3 mb-5">
                    <img src={logoPNG} alt="SwasthyaSync" className="w-10 h-10 object-contain brightness-0 invert opacity-80" />
                    <div>
                      <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight">SwasthyaSync</h2>
                      <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">AI-Powered OPD Platform</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Reimagining outpatient care with voice-first AI intake, real-time triage, and intelligent clinical decision support.
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full px-4 py-2.5 pr-11 rounded-full bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                    <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-all hover:scale-110">
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div className="absolute -right-8 -top-4 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
                </div>

                {/* Col 2 — Quick Links */}
                <div>
                  <h3 className="mb-5 text-sm font-bold text-white uppercase tracking-wider">Quick Links</h3>
                  <nav className="space-y-3 text-sm">
                    {[
                      { label: 'Patient Kiosk', href: '/kiosk/login' },
                      { label: 'Triage Queue', href: '/dashboard/triage' },
                      { label: 'Doctor Portal', href: '/doctor' },
                      { label: 'Admin Panel', href: '/admin' },
                      { label: 'Patient Mobile Portal', href: 'https://swasthyasync-patient-portal.vercel.app/login', isExternal: true },
                    ].map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target={link.isExternal ? '_blank' : undefined}
                        rel={link.isExternal ? 'noopener noreferrer' : undefined}
                        className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200"
                      >
                        <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-blue-500 transition-colors" />
                        {link.label}
                      </a>
                    ))}
                  </nav>
                </div>

                {/* Col 3 — Contact */}
                <div>
                  <h3 className="mb-5 text-sm font-bold text-white uppercase tracking-wider">Contact</h3>
                  <address className="space-y-3.5 text-sm not-italic">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-slate-400">Kolkata<br/>kolkata , India 700039</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-400">+91 9088260058</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-400">mdzeeshan08886@gmail.com</span>
                    </div>
                  </address>
                </div>

                {/* Col 4 — Social + Compliance */}
                <div>
                  <h3 className="mb-5 text-sm font-bold text-white uppercase tracking-wider">Connect</h3>
                  <div className="flex gap-2.5 mb-6">
                    {[
                      { Icon: Code2, tip: 'GitHub' },
                      { Icon: MessageCircle, tip: 'Twitter' },
                      { Icon: Link2, tip: 'LinkedIn' },
                      { Icon: Globe, tip: 'Website' },
                    ].map(({ Icon, tip }) => (
                      <button
                        key={tip}
                        title={tip}
                        className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-slate-500 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>ABDM & DPDP Compliant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                      <span>End-to-End Encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>ISO 27001 Architecture</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Divider + Bottom Bar */}
              <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  © {new Date().getFullYear()} SwasthyaSync Healthcare — All rights reserved.
                </p>
                <nav className="flex items-center gap-5 text-xs text-slate-500">
                  <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                  <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                  <a href="#" className="hover:text-white transition-colors">Accessibility</a>
                </nav>
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> for SIH 2025
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
