import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LoginScreen } from './screens/LoginScreen';
import { TabLayout } from './screens/TabLayout';
import { ChatScreen } from './screens/ChatScreen';
import { LanguageProvider } from './i18n/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <div className="w-full min-h-[100dvh] bg-slate-50 flex flex-col font-sans">
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/dashboard/*" element={<TabLayout />} />
            <Route path="/chat" element={<ChatScreen />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;

