
import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { LeaveRequests } from './components/LeaveRequests';
import { Profile } from './components/Profile';
import { StorageService } from './services/storageService';
import { User, Language } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leave' | 'profile'>('dashboard');
  const [language, setLanguage] = useState<Language>('IT');

  useEffect(() => {
    // Detect Browser Language on Load
    const browserLang = navigator.language.split('-')[0].toUpperCase();
    if (['IT', 'EN', 'ES', 'FR', 'DE'].includes(browserLang)) {
        setLanguage(browserLang as Language);
    } else {
        setLanguage('IT'); // Default fallback
    }

    const initUser = async () => {
      const storedUser = await StorageService.getSessionUser();
      if (storedUser) setUser(storedUser);
    };
    initUser();
  }, []);

  const handleLogin = (newUser: User) => setUser(newUser);
  const handleLogout = () => {
    StorageService.logout();
    setUser(null);
    setActiveTab('dashboard');
  };

  const refreshUser = async () => {
      const storedUser = await StorageService.getSessionUser();
      if (storedUser) setUser(storedUser);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} language={language} setLanguage={setLanguage} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
      {/* Navbar FIRST in DOM means LEFT side on Desktop (row layout) */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} language={language} />
      
      <main className="flex-1 relative overflow-hidden flex flex-col order-first md:order-last">
        <div className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
           {activeTab === 'dashboard' ? (
             <Dashboard user={user} language={language} refreshUser={refreshUser} />
           ) : activeTab === 'leave' ? (
             <LeaveRequests user={user} language={language} />
           ) : (
             <Profile user={user} onLogout={handleLogout} language={language} setLanguage={setLanguage} />
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
