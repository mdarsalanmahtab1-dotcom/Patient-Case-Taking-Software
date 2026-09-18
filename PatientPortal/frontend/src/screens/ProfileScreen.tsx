import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import { User, FileDown, LogOut, Globe, Shield, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import type { Language } from '../i18n/translations';
import logoPNG from '../assets/logoPNG.png';

export const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useTranslation();
  const token = localStorage.getItem('portal_token');
  const phone = localStorage.getItem('portal_phone') || '';
  const [exporting, setExporting] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API_BASE}/api/portal/export`, { headers });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swasthyasync_records_${phone}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Health vault exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export records.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    if (phone) {
      localStorage.removeItem(`portal_chat_${phone}`);
    }
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_phone');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const maskPhone = (p: string) => 'XXXXXX' + p.slice(-4);

  const languageNames: Record<Language, { label: string; native: string }> = {
    en: { label: 'English', native: 'English' },
    hi: { label: 'Hindi', native: 'हिन्दी' },
    bn: { label: 'Bengali', native: 'বাংলা' },
  };

  return (
    <div className="p-5 space-y-6 max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight pt-2">{t.profile.title}</h1>

      {/* Patient Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-3xl p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-slate-200/80 flex items-center gap-4"
      >
        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100/80 border border-blue-200/80 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
          <User className="w-7 h-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-extrabold text-slate-900 font-mono tracking-wide">{maskPhone(phone)}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{t.profile.patientDetails}</p>
        </div>
      </motion.div>

      {/* Grouped Action Items */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={exporting}
          className="w-full p-4 flex items-center gap-3.5 hover:bg-slate-50/70 transition-colors text-left disabled:opacity-50 group cursor-pointer"
        >
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-100/80 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
            {exporting ? (
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            ) : (
              <FileDown className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.profile.exportTitle}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{exporting ? t.profile.exporting : t.profile.exportDesc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowLanguageModal(true)}
          className="w-full p-4 flex items-center gap-3.5 hover:bg-slate-50/70 transition-colors text-left group cursor-pointer"
        >
          <div className="w-10 h-10 bg-purple-50 border border-purple-100/80 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.profile.languageTitle}</p>
            <p className="text-xs text-slate-500 mt-0.5">{languageNames[language].native} ({languageNames[language].label})</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>

        <div className="w-full p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 bg-blue-50 border border-blue-100/80 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{t.profile.privacyTitle}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.profile.privacyDesc}</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        whileHover={{ translateY: -1 }}
        onClick={handleLogout}
        className="w-full py-3.5 bg-red-50 border border-red-200/90 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-100/80 active:bg-red-200/80 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        {t.profile.logout}
      </motion.button>

      {/* Brand & Security Compliance Footer */}
      <div className="pt-4 pb-2 flex flex-col items-center justify-center text-center gap-2">
        <div className="flex items-center gap-2">
          <img src={logoPNG} alt="SwasthyaSync" className="w-5 h-5 object-contain opacity-80" />
          <span className="text-xs font-black tracking-tight text-slate-700">
            Swasthya<span className="text-blue-600">Sync</span>
          </span>
          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">v2.0</span>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold max-w-[280px] leading-relaxed">
          Compliant with DPDP Act 2023 & Ayushman Bharat Digital Mission (ABDM). All medical records are encrypted.
        </p>
      </div>

      {/* Language Picker Modal / Sheet */}
      <AnimatePresence>
        {showLanguageModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLanguageModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm -z-10"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-[0_20px_50px_rgba(15,23,42,0.25)] border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-900">{t.profile.selectLanguage}</h3>
                <button
                  onClick={() => setShowLanguageModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {(Object.keys(languageNames) as Language[]).map((langKey) => {
                  const isSelected = language === langKey;
                  return (
                    <motion.button
                      key={langKey}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setLanguage(langKey);
                        setShowLanguageModal(false);
                        toast.success(`Language set to ${languageNames[langKey].label}`);
                      }}
                      className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-sm font-extrabold">{languageNames[langKey].native}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{languageNames[langKey].label}</p>
                      </div>
                      {isSelected && (
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-xs">
                          <Check className="w-4 h-4 text-white stroke-[2.5]" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

