import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { Fingerprint, Lock, ChevronRight, Loader2, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import logoPNG from '../assets/logoPNG.png';

type Stage = 'ENTER_PHONE' | 'ENTER_OTP';

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('ENTER_PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  React.useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const parseError = (err: any, fallback: string = 'An error occurred.') => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    return fallback;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/portal/auth/init`, { phone });
      setTxnId(res.data.transaction_id);
      setPhoneHint(res.data.phone_hint);
      const code = res.data.debug_otp || '123456';
      setDemoOtp(code);
      setOtp(code);
      setResendCountdown(res.data.resend_after_seconds || 5);
      setStage('ENTER_OTP');
      toast.success(`Mock OTP generated: ${code}`);
    } catch (err: any) {
      const msg = parseError(err, 'Failed to send OTP. Try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit OTP.');
      toast.error('Please enter the 6-digit OTP.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/portal/auth/confirm`, {
        transaction_id: txnId,
        otp,
      });
      localStorage.setItem('portal_token', res.data.token);
      localStorage.setItem('portal_phone', res.data.phone);
      toast.success('Login verified!');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = parseError(err, 'Verification failed. Try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setError('');
    setOtp('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/portal/auth/init`, { phone });
      setTxnId(res.data.transaction_id);
      setPhoneHint(res.data.phone_hint);
      const code = res.data.debug_otp || '123456';
      setDemoOtp(code);
      setOtp(code);
      setResendCountdown(res.data.resend_after_seconds || 5);
      toast.success(`New Mock OTP generated: ${code}`);
    } catch (err: any) {
      const msg = parseError(err, 'Failed to resend OTP.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/25 to-slate-100 min-h-[100dvh]">

      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex flex-col items-center text-center"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-20 h-20 rounded-3xl bg-white shadow-[0_10px_32px_rgba(37,99,235,0.15)] border border-blue-100/80 flex items-center justify-center p-3 mb-3.5 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-blue-50/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          <img src={logoPNG} alt="SwasthyaSync Logo" className="w-full h-full object-contain relative z-10 drop-shadow-xs" />
        </motion.div>
        <div className="flex items-center gap-1.5 justify-center">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Swasthya<span className="text-blue-600">Sync</span>
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-full border border-blue-200/70 shadow-2xs">
            Portal
          </span>
        </div>
        <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1.5 max-w-[260px]">
          Smart Healthcare Companion & Digital Health Records
        </p>
      </motion.div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] border border-slate-200/80"
      >
        <AnimatePresence mode="wait">
          {stage === 'ENTER_PHONE' ? (
            <motion.form
              key="stage-phone"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSendOtp}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                  Mobile Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Fingerprint className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all"
                    autoFocus
                    maxLength={10}
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-semibold text-red-500 bg-red-50/90 border border-red-100 px-3.5 py-2.5 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                whileHover={{ translateY: -1 }}
                disabled={loading || phone.length < 10}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:bg-blue-700 active:bg-blue-800 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="stage-otp"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleVerifyOtp}
              className="space-y-5"
            >
              <button
                type="button"
                onClick={() => { setStage('ENTER_PHONE'); setOtp(''); setError(''); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Change number
              </button>

              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-blue-50 border border-blue-100/80 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Verification for <span className="text-blue-600 font-bold">{phoneHint}</span>
                </p>

                {/* Prominent Simulated Mock OTP Box */}
                <div className="mt-3.5 p-3.5 bg-gradient-to-br from-blue-50 via-indigo-50/70 to-slate-50 border border-blue-200/90 rounded-2xl shadow-xs text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider rounded-full mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Simulated Demo OTP
                  </div>
                  <p className="text-xs text-slate-600 mb-2 font-medium">
                    This is a mocked OTP simulating actual SMS delivery for this demo:
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtp(demoOtp || '123456')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-blue-50 border border-blue-300 rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-semibold text-slate-500">Your OTP:</span>
                    <span className="text-lg font-mono font-black tracking-widest text-blue-600 group-hover:scale-105 transition-transform">
                      {demoOtp || '123456'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md ml-1">
                      Auto-filled ✓
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                  Enter OTP
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <KeyRound className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="6-digit OTP"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-2xl text-base font-bold text-slate-900 tracking-[0.35em] text-center placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono"
                    autoFocus
                    maxLength={6}
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-semibold text-red-500 bg-red-50/90 border border-red-100 px-3.5 py-2.5 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                whileHover={{ translateY: -1 }}
                disabled={loading || otp.length < 6}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-[0_8px_20px_rgba(5,150,105,0.25)] hover:bg-emerald-700 active:bg-emerald-800 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Verify & Login
                    <ShieldCheck className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || resendCountdown > 0}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:text-slate-400 py-1"
              >
                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : "Didn't receive OTP? Resend"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>DPDP Act & ABDM M1 Secured</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">End-to-End Encrypted Patient Health Records</p>
        </div>
      </motion.div>
    </div>
  );
};

