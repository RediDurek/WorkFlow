
'use client';

import React, { useState } from 'react';
import { User, Language } from '../types';
import { UserPlus, LogIn, Building2, Eye, EyeOff, Mail, ArrowLeft, CheckSquare, Square, X, FileText, LockKeyhole, CreditCard } from 'lucide-react';
import { translations } from '../constants/translations';

interface AuthProps {
  onLogin: (user: User) => void;
  language: Language;
  setLanguage: (l: Language) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER_ORG' | 'REGISTER_EMPLOYEE' | 'VERIFY_EMAIL' | 'FORGOT_PASSWORD';

// Moved outside to avoid re-renders or type issues
const LegalModal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl"><h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><FileText size={20} className="text-brand-600"/> {title}</h3><button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20} /></button></div>
          <div className="p-6 overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-4">{children}</div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl"><button onClick={onClose} className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors">OK</button></div>
      </div>
  </div>
);

export const Auth: React.FC<AuthProps> = ({ onLogin, language, setLanguage }) => {
  const t = translations[language];
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [demoCode, setDemoCode] = useState<string>('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [taxId, setTaxId] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [contractType, setContractType] = useState<'DETERMINATO' | 'INDETERMINATO'>('INDETERMINATO');
  const [contractEndDate, setContractEndDate] = useState('');

  const resetForm = () => {
    setError(''); setSuccessMessage(''); setEmail(''); setPassword(''); setName(''); setOrgName(''); setOrgCode(''); setTaxId(''); setVerificationCode(''); setDemoCode(''); setPrivacyAccepted(false); setIsLoading(false); setNewPassword('');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError(t.passShort); return; }
    if(!privacyAccepted) { setError(t.acceptTermsRequired); return; }
    setError(''); setIsLoading(true);
    try {
      let res;
      if (mode === 'REGISTER_ORG') {
        res = await fetch('/api/auth/registerOrg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orgName, adminName: name, email, password, taxId }) });
      } else {
        res = await fetch('/api/auth/joinOrg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orgCode: orgCode.toUpperCase(), name, email, password, taxId, contractType, contractEndDate }) });
      }
      const data = await res.json();
      if (res.ok && data.success) {
        // if server returned an authenticated user (session created), log them in immediately
        if (data.user) {
          onLogin(data.user);
          return; // exit early
        }
        setMode('VERIFY_EMAIL');
        setDemoCode(data.demoCode || '');
        setSuccessMessage(t.verifyDesc);
      } else {
        setError(data.error || t.genericError);
      }
    } catch (err) { setError(t.genericError); } finally { setIsLoading(false); }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      const resp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
      const json = await resp.json();
      if (resp.ok && json.user) {
        onLogin(json.user);
      } else {
        const err = json.error || t.genericError;
        if (err.includes('verified') || err.toLowerCase().includes('email not verified') || err.toLowerCase().includes('verificat')) {
          setMode('VERIFY_EMAIL');
          const r = await fetch('/api/auth/resendCode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email }) });
          const d = await r.json();
          if (r.ok && d.code) setDemoCode(d.code);
          else setError(err);
        } else {
          setError(err);
        }
      }
    } catch (err) { setError(t.genericError); } finally { setIsLoading(false); }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccessMessage(''); setIsLoading(true);
    try {
      const resp = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, code: verificationCode }) });
      const data = await resp.json();
      if (resp.ok && data.user) {
        onLogin(data.user);
      } else if (data.error && data.error.includes('Attendi')) { setMode('LOGIN'); setSuccessMessage(data.error); resetForm(); setEmail(email); }
      else setError(data.error || t.invalidCode);
    } catch (err) { setError(t.genericError); } finally { setIsLoading(false); }
  };

  const handleInitiateReset = async (e: React.FormEvent) => {
      e.preventDefault(); setError(''); setIsLoading(true);
      try {
          const resp = await fetch('/api/auth/reset/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email }) });
        const data = await resp.json();
        if (resp.ok && data.success && data.demoCode) {
          setDemoCode(data.demoCode);
        } else {
          setError(data.error || t.genericError);
        }
      } catch (err) { setError(t.genericError); } finally { setIsLoading(false); }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
      e.preventDefault(); setError(''); setIsLoading(true);
      if (newPassword.length < 6) { setError(t.passShort); setIsLoading(false); return; }
      try {
        const resp = await fetch('/api/auth/reset/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, code: verificationCode, newPass: newPassword }) });
        const data = await resp.json();
        if (resp.ok && data.success) {
          alert(t.resetSuccess);
          resetForm();
          setMode('LOGIN');
        } else {
          setError(data.error || t.genericError);
        }
      } catch(err) { setError(t.genericError); } finally { setIsLoading(false); }
  };

  if (mode === 'VERIFY_EMAIL') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8">
            <div className="flex justify-center mb-6"><div className="bg-blue-100 p-4 rounded-full text-blue-600"><Mail size={48} /></div></div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">{t.verifyTitle}</h2>
            <p className="text-center text-gray-500 mb-6 text-sm">{t.verifyDesc} <strong>{email}</strong></p>
            {demoCode && (
                <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-800 p-4 rounded-xl mb-6 text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-white text-[10px] px-2 py-0.5 font-bold">{t.demoMode}</div>
                    <div className="text-4xl font-mono font-black tracking-widest cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(demoCode); setVerificationCode(demoCode); }}>{demoCode}</div>
                </div>
            )}
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
            <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold" placeholder="000000" maxLength={6} required />
                <button type="submit" disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg">{isLoading ? '...' : t.verifyBtn}</button>
            </form>
            <div className="mt-6 flex justify-between items-center text-sm"><button onClick={() => { setMode('LOGIN'); resetForm(); }} className="text-gray-400 hover:text-gray-600 flex items-center gap-1"><ArrowLeft size={14} /> {t.backToLogin}</button></div>
        </div>
      </div>
    );
  }

  if (mode === 'FORGOT_PASSWORD') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="flex justify-center mb-6"><div className="bg-brand-100 p-4 rounded-full text-brand-600"><LockKeyhole size={48} /></div></div>
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">{t.recoverPass}</h2>
                <p className="text-center text-gray-500 mb-6 text-sm">{t.recoverDesc}</p>

                {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
                
                {!demoCode ? (
                    <form onSubmit={handleInitiateReset} className="space-y-4">
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required placeholder={t.email} />
                        <button type="submit" disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg">{isLoading ? '...' : t.sendCode}</button>
                    </form>
                ) : (
                    <form onSubmit={handleCompleteReset} className="space-y-4">
                         <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-800 p-4 rounded-xl mb-6 text-center shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-yellow-400 text-white text-[10px] px-2 py-0.5 font-bold">{t.demoMode}</div>
                            <div className="text-4xl font-mono font-black tracking-widest cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(demoCode); setVerificationCode(demoCode); }}>{demoCode}</div>
                        </div>
                        <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center tracking-widest" placeholder="Code" maxLength={6} required />
                        <div className="relative">
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required placeholder={t.newPass} minLength={6} />
                            <div className="text-[10px] text-gray-400 mt-1 text-right">(min. 6 chars)</div>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg">{isLoading ? '...' : t.resetBtn}</button>
                    </form>
                )}
                
                <div className="mt-6 flex justify-between items-center text-sm"><button onClick={() => { setMode('LOGIN'); resetForm(); }} className="text-gray-400 hover:text-gray-600 flex items-center gap-1"><ArrowLeft size={14} /> {t.backToLogin}</button></div>
            </div>
        </div>
      );
  }

  return (
    <>
    {showTermsModal && <LegalModal title={t.termsTitle} onClose={() => setShowTermsModal(false)}><p>{t.termsBody}</p></LegalModal>}
    
    {showPrivacyModal && <LegalModal title={t.privacyTitle} onClose={() => setShowPrivacyModal(false)}><p>{t.privacyBody}</p></LegalModal>}

    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative">
      <div className="absolute top-4 right-4 z-10">
                    <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-white border border-gray-200 rounded-lg p-2 text-xl shadow-sm focus:outline-none">
            <option value="IT">IT</option>
            <option value="EN">EN</option>
            <option value="ES">ES</option>
            <option value="FR">FR</option>
            <option value="DE">DE</option>
          </select>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-brand-50 p-2 flex justify-between gap-2">
          <button onClick={() => { setMode('LOGIN'); resetForm(); }} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'LOGIN' ? 'bg-white shadow text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}>{t.btnAccess}</button>
          <button onClick={() => { setMode('REGISTER_EMPLOYEE'); resetForm(); }} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'REGISTER_EMPLOYEE' ? 'bg-white shadow text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}>{t.registerEmpTitle}</button>
          <button onClick={() => { setMode('REGISTER_ORG'); resetForm(); }} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'REGISTER_ORG' ? 'bg-white shadow text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}>{t.registerOrgTitle}</button>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-6 text-brand-600"><div className="bg-brand-100 p-4 rounded-2xl">{mode === 'LOGIN' ? <LogIn size={32} /> : <Building2 size={32} />}</div></div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{mode === 'LOGIN' ? t.loginTitle : mode === 'REGISTER_ORG' ? t.registerOrgTitle : t.registerEmpTitle}</h1>
          <p className="text-center text-gray-500 mb-6 text-sm">{mode === 'LOGIN' ? t.loginDesc : mode === 'REGISTER_ORG' ? t.registerOrgDesc : t.registerEmpDesc}</p>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 text-center">{error}</div>}
          
          <form onSubmit={mode === 'LOGIN' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
            {mode !== 'LOGIN' && <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.name}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required /></div>}
            {mode === 'REGISTER_ORG' && <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.orgName}</label><input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required /></div>}
            {mode === 'REGISTER_EMPLOYEE' && <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.orgCode}</label><input type="text" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required /></div>}
            {mode !== 'LOGIN' && <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.taxId}</label><input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 uppercase" required /></div>}
            {mode === 'REGISTER_EMPLOYEE' && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Tipo di contratto</label>
                  <select value={contractType} onChange={e => setContractType(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <option value="INDETERMINATO">Indeterminato</option>
                    <option value="DETERMINATO">Determinato</option>
                  </select>
                </div>
                {contractType === 'DETERMINATO' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Data scadenza</label>
                    <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" />
                  </div>
                )}
              </div>
            )}
            
            <div><label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.email}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3" required /></div>
            <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">{t.password}</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-12" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-8 text-gray-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                {mode !== 'LOGIN' && <div className="text-[10px] text-gray-400 mt-1 text-right">(min. 6 chars)</div>}
            </div>
            
            {mode === 'LOGIN' && (
                <div className="flex justify-end">
                    <button type="button" onClick={() => { setMode('FORGOT_PASSWORD'); resetForm(); }} className="text-xs text-brand-600 font-bold hover:underline">{t.forgotPass}</button>
                </div>
            )}
            
            {mode !== 'LOGIN' && (
              <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                <button type="button" onClick={() => setPrivacyAccepted(!privacyAccepted)} className={`mt-0.5 ${privacyAccepted ? 'text-brand-600' : 'text-gray-300'}`}>{privacyAccepted ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                <div className="text-xs text-gray-500 leading-tight">
                    {t.acceptTerms} <button type="button" onClick={() => setShowTermsModal(true)} className="text-brand-600 font-bold hover:underline">Terms</button> & <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-brand-600 font-bold hover:underline">Privacy</button>.
                </div>
              </div>
            )}
            <button type="submit" disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg mt-4 disabled:opacity-70">{isLoading ? '...' : mode === 'LOGIN' ? t.btnAccess : t.btnRegister}</button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
};
