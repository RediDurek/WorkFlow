'use client';

import React, { useState } from 'react';
import { X, Check, CreditCard, Smartphone, Globe } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Language } from '../types';
import { translations } from '../constants/translations';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess: () => void;
  mode?: 'TRIAL_SETUP' | 'UPGRADE';
  language: Language;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, orgId, onSuccess, mode = 'UPGRADE', language }) => {
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'APPLE' | 'GOOGLE'>('CARD');

  if (!isOpen) return null;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await StorageService.linkPaymentMethod(orgId);
    setLoading(false);
    if (success) {
      onSuccess();
    } else {
      alert("Error");
    }
  };

  const isTrialSetup = mode === 'TRIAL_SETUP';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {!isTrialSetup && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"><X size={20} /></button>
        )}

        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white text-center relative overflow-hidden">
            <h2 className="text-2xl font-bold mb-2 relative z-10">{isTrialSetup ? t.trialTitle : t.upgradeTitle}</h2>
            <p className="text-brand-100 text-sm relative z-10">{isTrialSetup ? t.trialSubtitle : 'Unlimited Access.'}</p>
        </div>

        <div className="p-8">
            <div className="mb-6 text-center">
                <span className="text-4xl font-bold text-gray-900">8€</span>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <button type="button" onClick={() => setPaymentMethod('APPLE')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'APPLE' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}><Smartphone size={20} /><span className="text-[10px] font-bold">Apple Pay</span></button>
                    <button type="button" onClick={() => setPaymentMethod('GOOGLE')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'GOOGLE' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}><Globe size={20} /><span className="text-[10px] font-bold">Google Pay</span></button>
                    <button type="button" onClick={() => setPaymentMethod('CARD')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${paymentMethod === 'CARD' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}><CreditCard size={20} /><span className="text-[10px] font-bold">Card</span></button>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-black text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-gray-800 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-70">
                    {loading ? '...' : isTrialSetup ? t.startTrialBtn : t.payBtn}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
