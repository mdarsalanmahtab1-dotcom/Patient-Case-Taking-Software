import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, ActivitySquare, Stethoscope, ShieldCheck, ExternalLink, Wifi, FileText, Lock, Scale, Info, CheckCircle2, Send, Code2, Link2, MessageCircle, Globe, Mail, Phone, MapPin, Heart, Sparkles, Scan, ArrowRight } from 'lucide-react';
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

  const coreModules = [
    {
      badge: "Self-Service",
      title: "Patient Kiosk",
      description: "Voice-guided AI intake, ABHA lookup, registration & document OCR.",
      icon: <MonitorSmartphone className="w-5 h-5 text-emerald-600" />,
      path: "/kiosk/login",
      borderColor: "border-emerald-200/90",
      iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      hoverBorder: "hover:border-emerald-400",
      shadowColor: "hover:shadow-emerald-200/50",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    },
    {
      badge: "Nurse Station",
      title: "Triage Nurse Queue",
      description: "Live queue monitoring, algorithmic triage acuity & emergency red-flag sorting.",
      icon: <ActivitySquare className="w-5 h-5 text-rose-600" />,
      path: "/dashboard/triage",
      borderColor: "border-rose-200/90",
      iconBg: "bg-rose-50 text-rose-600 border border-rose-100",
      hoverBorder: "hover:border-rose-400",
      shadowColor: "hover:shadow-rose-200/50",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200/70",
    },
    {
      badge: "Physician EMR",
      title: "Doctor Dashboard",
      description: "View AI SOAP summaries, sign casesheets & review OCR lab reports.",
      icon: <Stethoscope className="w-5 h-5 text-cyan-600" />,
      path: "/doctor",
      borderColor: "border-cyan-200/90",
      iconBg: "bg-cyan-50 text-cyan-600 border border-cyan-100",
      hoverBorder: "hover:border-cyan-400",
      shadowColor: "hover:shadow-cyan-200/50",
      badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200/70",
    },
    {
      badge: "Hospital Ops",
      title: "Hospital Admin",
      description: "Role-Based Access Control (RBAC), doctor rosters & staff analytics.",
      icon: <ShieldCheck className="w-5 h-5 text-purple-600" />,
      path: "/admin",
      borderColor: "border-purple-200/90",
      iconBg: "bg-purple-50 text-purple-600 border border-purple-100",
      hoverBorder: "hover:border-purple-400",
      shadowColor: "hover:shadow-purple-200/50",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200/70",
    },
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
        <div className="absolute top-3.5 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <motion.header
            style={{
              paddingTop: headerPaddingY,
              paddingBottom: headerPaddingY,
              boxShadow: headerShadow,
              backdropFilter: headerBlur,
              WebkitBackdropFilter: headerBlur
            }}
            className="pointer-events-auto w-full max-w-3xl px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between bg-white border border-slate-100 rounded-full shadow-lg z-10"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center rounded-full overflow-hidden bg-white mr-2 sm:mr-3">
                <img src={logoPNG} alt="SwasthyaSync Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">SwasthyaSync</h1>
                <p className="text-[8px] sm:text-[9px] text-blue-600 font-bold tracking-wide uppercase">AI-Powered OPD Presentation</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Demo Mode
              </div>
            </div>
          </motion.header>
        </div>

        {/* ─── Scrollable Content ─── */}
        <main
          ref={scrollRef}
          className="flex-1 relative overflow-y-auto overflow-x-hidden pt-18 sm:pt-20"
          tabIndex={-1}
        >
          {/* Background gradient orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-2 pb-6 relative z-10">
            {/* Compact Header Title */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="text-center mb-3 sm:mb-4 flex flex-col items-center"
            >
              <div className="flex items-center justify-center gap-2.5 mb-1">
                <motion.img
                  src={logoPNG}
                  alt="SwasthyaSync Logo"
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-xs"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
                />
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500">
                  SwasthyaSync OPD
                </h1>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-xl mx-auto leading-normal">
                Built to drastically reduce OPD wait times and streamline clinical workflows through AI-driven triage and automated history-taking.
              </p>
            </motion.div>

            {/* ─── Module Cards Grid: All 4 Options in 1 View ─── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-3.5"
            >
              {coreModules.map((mod, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => navigate(mod.path)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + idx * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    group flex flex-col justify-between text-left p-4 sm:p-4.5 rounded-2xl border-2 ${mod.borderColor}
                    bg-white shadow-card
                    transition-[transform,box-shadow,border-color] duration-150 cursor-pointer
                    ${mod.hoverBorder} ${mod.shadowColor} hover:shadow-card-hover h-full
                  `}
                >
                  <div>
                    {/* Top: Icon + Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className={`p-2 rounded-xl ${mod.iconBg} transition-transform duration-200 group-hover:scale-110 shrink-0`}>
                        {mod.icon}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${mod.badgeColor}`}>
                        {mod.badge}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-slate-900 font-extrabold text-sm sm:text-base mb-1 tracking-tight group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed mb-3">
                      {mod.description}
                    </p>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                    <span>Launch Module</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {/* ─── Patient Mobile Portal & AI Companion (Compact Full-Width Banner) ─── */}
            <motion.button
              onClick={() => window.open("https://swasthyasync-patient-portal.vercel.app/login", '_blank')}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              whileHover={{ y: -2, scale: 1.004 }}
              whileTap={{ scale: 0.99 }}
              className="w-full group flex flex-col sm:flex-row items-center justify-between text-left p-3 sm:p-3.5 rounded-2xl border-2 border-indigo-200/90 bg-gradient-to-r from-white via-indigo-50/40 to-blue-50/40 shadow-card hover:border-indigo-400 hover:shadow-indigo-100/60 hover:shadow-card-hover transition-all duration-150 cursor-pointer gap-3.5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-bl from-indigo-200/20 to-transparent rounded-bl-full pointer-events-none" />

              {/* Left: Compact QR Code with SCAN ME badge */}
              <div className="flex items-center gap-3 shrink-0 relative z-10">
                <div className="p-1.5 bg-white rounded-xl border-2 border-indigo-200/90 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                  <QRCode value="https://swasthyasync-patient-portal.vercel.app/login" size={54} className="rounded" />
                </div>
                <div className="flex flex-col items-center sm:items-start gap-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs animate-pulse">
                    <Scan className="w-2.5 h-2.5" />
                    SCAN ME
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">On Smartphone</span>
                </div>
              </div>

              {/* Center: Info */}
              <div className="flex-1 min-w-0 text-center sm:text-left relative z-10">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
                    <Sparkles className="w-3 h-3" />
                    AI Medical Assistant Live
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live OPD Queue Sync
                  </span>
                </div>
                <h3 className="text-slate-900 font-extrabold text-sm sm:text-base group-hover:text-indigo-600 transition-colors">
                  Patient Mobile Web Portal & AI Health Companion
                </h3>
                <p className="text-slate-500 text-xs font-medium leading-snug line-clamp-1 sm:line-clamp-none">
                  Scan with your phone to access live OPD queue token, consult our 24/7 empathetic Medical Copilot, and review digital prescription history.
                </p>
              </div>

              {/* Right: Launch Pill */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 shrink-0 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200/70 group-hover:bg-indigo-100/70 transition-all relative z-10">
                <span>Open on Web</span>
                <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          </div>

          {/* ─── System Guide & Privacy Terms ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-8 sm:mt-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden"
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
