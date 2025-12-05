'use client';

import React, { useState, useEffect } from 'react';
import { User, Language, Organization } from '../types';
import { StorageService } from '../services/storageService';
import { Download, Trash2, Shield, User as UserIcon, Building, LogOut, CreditCard, HelpCircle } from 'lucide-react';
import { translations } from '../constants/translations';
import { OnboardingTutorial } from './OnboardingTutorial';
import { formatDate } from '../lib/format';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  language: Language;
  setLanguage: (l: Language) => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogout, language, setLanguage }) => {
  const t = translations[language];
  const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
  const [isDeleting, setIsDeleting] = useState(false);
  const [org, setOrg] = useState<Organization | undefined>(undefined);
  const [showTutorial, setShowTutorial] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ type: string; badge: string; label: string }>({ type: user.contractType || 'INDETERMINATO', badge: 'bg-green-100 text-green-700', label: t.contractTypeIndef });
  
  // Export State
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth());
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const loadOrg = async () => {
      if (user.role === 'ADMIN') {
        const o = await StorageService.getOrganization(user.orgId);
        setOrg(o);
      }
    };
    loadOrg();
    // compute contract badge
    const type = user.contractType;
    if (!type) {
      setContractInfo({ type: 'NONE', badge: 'bg-gray-100 text-gray-700', label: t.contractMissing });
      return;
    }
    let badge = 'bg-green-100 text-green-700';
    let label = type === 'INDETERMINATO' ? t.contractTypeIndef : t.contractTypeDef;
    if (type === 'DETERMINATO' && user.contractEndDate) {
      const days = Math.ceil((new Date(user.contractEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 30) badge = 'bg-red-100 text-red-700';
      else badge = 'bg-yellow-100 text-yellow-800';
      label += ` (${t.contractExpiresOn} ${formatDate(user.contractEndDate, locale)})`;
    }
    setContractInfo({ type, badge, label });
  }, [user]);

  const handleExport = async () => {
    const docContent = await StorageService.exportDataAsDoc(user.role === 'EMPLOYEE' ? user.id : undefined, user.orgId, exportMonth, exportYear, language, [user]);
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const monthName = new Date(exportYear, exportMonth).toLocaleString('default', { month: 'long' });
    link.setAttribute('download', `My_Report_${exportYear}_${monthName}.doc`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAccount = async () => {
      if(confirm(t.confirmDeleteAccount)) {
          setIsDeleting(true);
          await StorageService.deleteAccount();
          onLogout();
      }
  };

  const handleCancelRenew = async () => {
      if(confirm(t.confirmCancelRenew)) {
          await StorageService.cancelAutoRenew();
          setOrg(prev => prev ? {...prev, autoRenew: false} : undefined);
          alert(t.cancelSuccess);
      }
  };

  return (
    <div className="max-w-md mx-auto w-full pt-safe px-4 pb-24">
      {showTutorial && <OnboardingTutorial user={user} language={language} onComplete={() => setShowTutorial(false)} />}
      
      <header className="mb-8 mt-6 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">{t.myProfile}</h1>
            <p className="text-gray-500 text-sm">{t.manageAccount}</p>
        </div>
        
        {/* Language Selector */}
        <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-white border border-gray-200 rounded-lg p-2 text-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
            <option value="IT">Italiano</option>
            <option value="EN">English</option>
            <option value="ES">Espa?ol</option>
            <option value="FR">Fran?ais</option>
            <option value="DE">Deutsch</option>
        </select>
      </header>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-4 mb-4">
              <div className="bg-brand-100 p-3 rounded-full text-brand-600"><UserIcon size={32} /></div>
              <div><h2 className="text-lg font-bold text-gray-900">{user.name}</h2><p className="text-gray-500 text-sm">{user.email}</p></div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 p-3 rounded-xl mb-3"><Building size={16} /><span>{t.role}: <strong>{user.role}</strong></span></div>
          <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="text-gray-700 font-semibold">{t.contractLabel}</div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${contractInfo.badge}`}>{contractInfo.label}</span>
          </div>
      </div>

      <div className="mb-6">
        <button onClick={() => setShowTutorial(true)} className="w-full bg-blue-50 text-blue-700 p-4 rounded-xl flex items-center gap-3 hover:bg-blue-100 transition-colors shadow-sm font-semibold">
            <HelpCircle size={20} />
            {t.howItWorks}
        </button>
      </div>

      {user.role === 'ADMIN' && org && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-brand-100 mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><CreditCard size={64} className="text-brand-600" /></div>
              <h3 className="text-lg font-bold text-gray-800 mb-3 relative z-10">{t.subsManage}</h3>
              
              <div className="space-y-2 mb-4 relative z-10">
                  <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Stato:</span>
                      <span className="font-bold text-brand-600">{org.subscriptionStatus === 'TRIAL' ? t.trialActive : 'PRO Active'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{org.autoRenew ? t.renewsOn : t.expiresOn}:</span>
                      <span className="font-mono">{formatDate(org.subscriptionStatus === 'TRIAL' ? org.trialEndsAt : Date.now() + 30*24*60*60*1000, locale)}</span>
                  </div>
              </div>

              {org.autoRenew ? (
                  <button onClick={handleCancelRenew} className="w-full bg-red-50 text-red-600 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors relative z-10">
                      {t.cancelRenew}
                  </button>
              ) : (
                  <div className="w-full bg-gray-100 text-gray-500 py-2 rounded-xl text-center text-sm font-bold relative z-10">
                      {t.renewCancelled}
                  </div>
              )}
          </div>
      )}

      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><Shield size={18} className="text-gray-400" /> {t.privacyGdpr}</h3>
      <div className="space-y-3">
          <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
             <div className="flex items-center gap-3 mb-3">
                 <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Download size={20} /></div>
                 <div className="text-left font-bold text-gray-800">{t.exportData}</div>
             </div>
             
             <div className="flex gap-2 mb-3">
                 <select value={exportMonth} onChange={(e) => setExportMonth(parseInt(e.target.value))} className="bg-gray-50 border border-gray-200 rounded-lg text-sm p-2 w-full">
                    {t.months.map((m, i) => (
                        <option key={i} value={i}>{m}</option>
                    ))}
                 </select>
                 <select value={exportYear} onChange={(e) => setExportYear(parseInt(e.target.value))} className="bg-gray-50 border border-gray-200 rounded-lg text-sm p-2 w-full">
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                 </select>
             </div>
             
             <button onClick={handleExport} className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-brand-700">
                 {t.exportBtn}
             </button>
          </div>
          
          <button onClick={handleDeleteAccount} disabled={isDeleting} className="w-full bg-white border border-red-100 p-4 rounded-xl flex items-center justify-between hover:bg-red-50 transition-colors shadow-sm group">
              <div className="flex items-center gap-3"><div className="bg-red-50 text-red-600 p-2 rounded-lg group-hover:bg-red-100"><Trash2 size={20} /></div><div className="text-left"><div className="font-bold text-red-600">{t.deleteAccount}</div></div></div>
          </button>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-6">
        <button onClick={onLogout} className="w-full bg-gray-100 text-gray-600 p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors font-bold"><LogOut size={20} /> {t.navLogout}</button>
      </div>
    </div>
  );
};
