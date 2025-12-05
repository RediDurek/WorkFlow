
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { LeaveRequests } from './components/LeaveRequests';
import { Adjustments } from './components/Adjustments';
import { Announcements } from './components/Announcements';
import { Roles } from './components/Roles';
import { Profile } from './components/Profile';
import { StorageService } from './services/storageService';
import { User, Language } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leave' | 'adjustments' | 'announcements' | 'roles' | 'profile'>('dashboard');
  const [language, setLanguageState] = useState<Language>('IT');
  const [leaveUnreadCount, setLeaveUnreadCount] = useState<number>(0);
  const [adjustmentsPendingCount, setAdjustmentsPendingCount] = useState<number>(0);
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState<number>(0);
  const [isBooting, setIsBooting] = useState(true);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('wf_lang', lang);
    } catch {}
  }, [setLanguageState]);

  useEffect(() => {
    // Detect Browser Language on Load or restore saved preference
    const supported = ['IT', 'EN', 'ES', 'FR', 'DE'];
    let initial: Language = 'IT';
    try {
      const saved = localStorage.getItem('wf_lang')?.toUpperCase();
      if (saved && supported.includes(saved)) {
        initial = saved as Language;
      } else {
        const browserLang = navigator.language.split('-')[0].toUpperCase();
        if (supported.includes(browserLang)) initial = browserLang as Language;
      }
    } catch {}
    setLanguage(initial);

    const initUser = async () => {
      try {
        const resp = await fetch('/api/auth/session', { credentials: 'include' });
        const data = await resp.json();
        if (resp.ok && data.user) setUser(data.user);
      } catch (err) {
        console.error('Init session error', err);
      } finally {
        setIsBooting(false);
      }
    };
    initUser();
  }, [setLanguage]);

  const handleLogin = (newUser: User) => setUser(newUser);
  const handleLogout = () => {
    (async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) { console.error('Logout error', err); }
      setUser(null);
      setActiveTab('dashboard');
      setLeaveUnreadCount(0);
      setAdjustmentsPendingCount(0);
    })();
  };

  const refreshUser = async () => {
      try {
        const resp = await fetch('/api/auth/session', { credentials: 'include' });
        const data = await resp.json();
        if (resp.ok && data.user) setUser(data.user);
      } catch (err) {
        console.error('Refresh session error', err);
      }
  };

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setLeaveUnreadCount(0);
      setAdjustmentsPendingCount(0);
      return;
    }
    try {
      const list = await StorageService.getNotifications();
      const unread = list.filter(n => !n.readAt);
      const leaveUnread = unread.filter(n => n.type?.toUpperCase().startsWith('LEAVE_')).length;
      setLeaveUnreadCount(leaveUnread);

      if (user.role === 'ADMIN') {
        const adjustments = await StorageService.getAdjustments();
        setAdjustmentsPendingCount(adjustments.filter((a: any) => a.status === 'PENDING').length);
      } else {
        const adjustmentNotifs = unread.filter(n => n.type?.toUpperCase().startsWith('ADJUSTMENT_')).length;
        setAdjustmentsPendingCount(adjustmentNotifs);
      }

      const announcementUnread = unread.filter(n => n.type?.toUpperCase().startsWith('ANNOUNCEMENT_')).length;
      setAnnouncementsUnreadCount(announcementUnread);
    } catch (err) {
      console.error('Notifications fetch error', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, loadNotifications]);

  useEffect(() => {
    if (activeTab !== 'leave' && activeTab !== 'announcements') return;
    (async () => {
      try {
        if (activeTab === 'leave') await StorageService.markNotificationsRead();
        if (activeTab === 'announcements') await StorageService.markAnnouncementRead();
        await loadNotifications();
      } catch (err) {
        console.error('Mark read error', err);
      }
    })();
  }, [activeTab, loadNotifications]);

  if (isBooting) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Auth onLogin={handleLogin} language={language} setLanguage={setLanguage} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
      {/* Navbar FIRST in DOM means LEFT side on Desktop (row layout) */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        language={language} 
        leaveUnreadCount={leaveUnreadCount}
        adjustmentsPendingCount={adjustmentsPendingCount}
        announcementsUnreadCount={announcementsUnreadCount}
        isAdmin={user.role === 'ADMIN'}
      />
      
      <main className="flex-1 relative overflow-hidden flex flex-col order-first md:order-last">
        <div className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
           {activeTab === 'dashboard' ? (
             <Dashboard user={user} language={language} refreshUser={refreshUser} onOpenLeave={() => setActiveTab('leave')} />
           ) : activeTab === 'leave' ? (
             <LeaveRequests user={user} language={language} refreshNotifications={loadNotifications} />
           ) : activeTab === 'adjustments' ? (
             <Adjustments user={user} language={language} refreshCounts={loadNotifications} />
           ) : activeTab === 'announcements' ? (
             <Announcements user={user} language={language} />
           ) : activeTab === 'roles' ? (
             <Roles user={user} language={language} />
           ) : (
             <Profile user={user} onLogout={handleLogout} language={language} setLanguage={setLanguage} />
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
