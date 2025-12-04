
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { LeaveRequests } from './components/LeaveRequests';
import { Adjustments } from './components/Adjustments';
import { Profile } from './components/Profile';
import { StorageService } from './services/storageService';
import { User, Language } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leave' | 'adjustments' | 'profile'>('dashboard');
  const [language, setLanguage] = useState<Language>('IT');
  const [leaveUnreadCount, setLeaveUnreadCount] = useState<number>(0);
  const [adjustmentsPendingCount, setAdjustmentsPendingCount] = useState<number>(0);

  useEffect(() => {
    // Detect Browser Language on Load
    const browserLang = navigator.language.split('-')[0].toUpperCase();
    if (['IT', 'EN', 'ES', 'FR', 'DE'].includes(browserLang)) {
        setLanguage(browserLang as Language);
    } else {
        setLanguage('IT'); // Default fallback
    }

    const initUser = async () => {
      try {
        const resp = await fetch('/api/auth/session', { credentials: 'include' });
        const data = await resp.json();
        if (resp.ok && data.user) setUser(data.user);
      } catch (err) {
        console.error('Init session error', err);
      }
    };
    initUser();
  }, []);

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

      const adjustments = await StorageService.getAdjustments(user.role === 'ADMIN' ? undefined : user.id);
      if (user.role === 'ADMIN') {
        setAdjustmentsPendingCount(adjustments.filter((a: any) => a.status === 'PENDING').length);
      } else {
        setAdjustmentsPendingCount(adjustments.filter((a: any) => a.status === 'PENDING').length);
      }
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
    if (activeTab === 'leave') {
      (async () => {
        try {
          await StorageService.markNotificationsRead();
          await loadNotifications();
        } catch (err) {
          console.error('Mark read error', err);
        }
      })();
    }
  }, [activeTab, loadNotifications]);

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
      />
      
      <main className="flex-1 relative overflow-hidden flex flex-col order-first md:order-last">
        <div className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
           {activeTab === 'dashboard' ? (
             <Dashboard user={user} language={language} refreshUser={refreshUser} onOpenLeave={() => setActiveTab('leave')} />
           ) : activeTab === 'leave' ? (
             <LeaveRequests user={user} language={language} refreshNotifications={loadNotifications} />
           ) : activeTab === 'adjustments' ? (
             <Adjustments user={user} language={language} refreshCounts={loadNotifications} />
           ) : (
             <Profile user={user} onLogout={handleLogout} language={language} setLanguage={setLanguage} />
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
