import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ClipboardList, Building2, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HomeScreen } from './HomeScreen';
import { HistoryScreen } from './HistoryScreen';
import { HospitalInfoScreen } from './HospitalInfoScreen';
import { ProfileScreen } from './ProfileScreen';
import { useTranslation } from '../i18n/LanguageContext';

export const TabLayout: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const tabs = [
    { id: 'home', label: t.tabs.home, icon: Home },
    { id: 'history', label: t.tabs.history, icon: ClipboardList },
    { id: 'hospital', label: t.tabs.hospital, icon: Building2 },
    { id: 'profile', label: t.tabs.profile, icon: UserCircle },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeScreen onNavigateToTab={(tab) => setActiveTab(tab)} />;
      case 'history': return <HistoryScreen />;
      case 'hospital': return <HospitalInfoScreen />;
      case 'profile': return <ProfileScreen />;
      default: return <HomeScreen onNavigateToTab={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] max-w-md mx-auto bg-slate-50 relative overflow-hidden">
      {/* Active Tab Content with Smooth Transitions */}
      <div className="flex-1 overflow-y-auto pb-24 touch-pan-y">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Glassmorphic Apple-style Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 pointer-events-auto">
        <div className="max-w-md mx-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-[0_8px_32px_rgba(15,23,42,0.08)] px-2 py-1.5 flex items-center justify-around relative">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={{ scale: 0.92 }}
                  className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-colors ${
                    isActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
                  }`}
                  aria-label={tab.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-bubble"
                      className="absolute inset-0 bg-blue-50/90 rounded-2xl -z-10 border border-blue-100/80 shadow-xs"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'stroke-[2.4] scale-105' : 'stroke-[1.6]'
                    }`}
                  />
                  <span className={`text-[10px] tracking-tight mt-0.5 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

