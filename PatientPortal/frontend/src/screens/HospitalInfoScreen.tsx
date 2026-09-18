import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_BASE } from '../config';
import { Heart, Stethoscope, Loader2, Users, Activity, PhoneCall } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import logoPNG from '../assets/logoPNG.png';

interface Department {
  dept_id: number;
  name: string;
  available_doctors: number;
}

interface HospitalInfo {
  hospital_name: string;
  departments: Department[];
  active_patients_today: number;
}

const deptIcons: Record<string, React.ReactNode> = {
  cardiology: <Heart className="w-5 h-5 text-rose-600" />,
  nephrology: <Activity className="w-5 h-5 text-purple-600" />,
  'general medicine': <Stethoscope className="w-5 h-5 text-cyan-600" />,
};

export const HospitalInfoScreen: React.FC = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<HospitalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/portal/hospital-info`);
        setInfo(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading hospital information...</p>
      </div>
    );
  }

  if (!info) {
    return <div className="p-8 text-center text-slate-500 font-medium text-sm">{t.common.error}</div>;
  }

  return (
    <div className="p-5 space-y-6 max-w-md mx-auto">
      {/* Hospital Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-3xl p-6 text-white shadow-[0_12px_32px_rgba(37,99,235,0.25)] border border-blue-500/40 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 border border-white/30 shadow-sm shrink-0">
              <img src={logoPNG} alt="SwasthyaSync Hospital" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg font-extrabold tracking-tight">{info.hospital_name || t.hospital.subtitle}</h1>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-white/20 text-white rounded-md uppercase backdrop-blur-sm border border-white/20">
                  SwasthyaSync
                </span>
              </div>
              <p className="text-blue-100 text-xs font-medium">{t.hospital.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/15">
              <p className="text-2xl font-black font-mono tabular-nums">{info.departments.length}</p>
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mt-0.5">{t.hospital.departmentsTitle}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/15">
              <p className="text-2xl font-black font-mono tabular-nums">{info.active_patients_today}</p>
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mt-0.5">{t.hospital.activePatientsToday}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Departments */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">{t.hospital.departmentsTitle}</h2>
        <div className="grid grid-cols-1 gap-2.5">
          {info.departments.map((dept) => (
            <motion.div
              key={dept.dept_id}
              whileHover={{ translateY: -1 }}
              className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-4 hover:border-blue-200 transition-all"
            >
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                {deptIcons[dept.name.toLowerCase()] || <Stethoscope className="w-5 h-5 text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900 capitalize truncate">{dept.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium">{dept.available_doctors} {t.hospital.doctorsAvailable}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  dept.available_doctors > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'
                }`} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Emergency Info */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="bg-red-50/80 border border-red-200/90 rounded-3xl p-5 shadow-xs"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-xl bg-red-100/80 flex items-center justify-center">
            <PhoneCall className="w-4 h-4 text-red-600" />
          </div>
          <h3 className="text-sm font-extrabold text-red-900">{t.hospital.emergencyTitle}</h3>
        </div>
        <p className="text-xs text-red-700 leading-relaxed mb-3 font-medium">{t.hospital.emergencyDesc}</p>
        <a
          href={`tel:${t.hospital.emergencyNumber.replace(/\D/g, '') || '108'}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-colors cursor-pointer"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Call {t.hospital.emergencyNumber}</span>
        </a>
      </motion.div>
    </div>
  );
};

