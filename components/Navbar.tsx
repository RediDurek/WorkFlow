'use client';

import React from 'react';
import { Clock, Calendar, LogOut, UserCircle } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../constants/translations';

interface NavbarProps {
  activeTab: 'dashboard' | 'leave' | 'profile';
  setActiveTab: (tab: 'dashboard' | 'leave' | 'profile') => void;
  onLogout: () => void;
  language: Language;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onLogout, language }) => {
  const t = translations[language];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe px-6 py-3 shadow-lg z-50 flex justify-between items-center md:static md:flex-col md:w-64 md:h-screen md:border-r md:border-t-0 md:justify-start md:space-y-8 md:p-6">
      
      <div className="hidden md:block text-2xl font-bold text-brand-600 mb-8">
        WorkFlow
      </div>

      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col md:flex-row md:w-full md:space-x-3 items-center justify-center p-2 rounded-xl transition-colors ${
          activeTab === 'dashboard' ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Clock size={24} />
        <span className="text-xs md:text-base font-medium mt-1 md:mt-0">{t.navTime}</span>
      </button>

      <button
        onClick={() => setActiveTab('leave')}
        className={`flex flex-col md:flex-row md:w-full md:space-x-3 items-center justify-center p-2 rounded-xl transition-colors ${
          activeTab === 'leave' ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Calendar size={24} />
        <span className="text-xs md:text-base font-medium mt-1 md:mt-0">{t.navLeaves}</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col md:flex-row md:w-full md:space-x-3 items-center justify-center p-2 rounded-xl transition-colors ${
          activeTab === 'profile' ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <UserCircle size={24} />
        <span className="text-xs md:text-base font-medium mt-1 md:mt-0">{t.navProfile}</span>
      </button>

      <div className="w-px h-8 bg-gray-200 md:hidden"></div>
      <div className="md:flex-grow"></div>

      <button
        onClick={onLogout}
        className="flex flex-col md:flex-row md:w-full md:space-x-3 items-center justify-center p-2 text-red-400 hover:text-red-600 rounded-xl transition-colors"
      >
        <LogOut size={24} />
        <span className="text-xs md:text-base font-medium mt-1 md:mt-0">{t.navLogout}</span>
      </button>
    </div>
  );
};
