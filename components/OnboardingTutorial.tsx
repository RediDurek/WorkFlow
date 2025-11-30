
import React, { useState } from 'react';
import { User, Language } from '../types';
import { translations } from '../constants/translations';
import { ChevronRight, ChevronLeft, Clock, Users, Download, Sparkles, Calendar, FileText, Shield } from 'lucide-react';

interface OnboardingTutorialProps {
  user: User;
  language: Language;
  onComplete: () => void;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ user, language, onComplete }) => {
  const t = translations[language];
  const [step, setStep] = useState(0);

  const steps = user.role === 'ADMIN' ? [
    { title: t.tutAdm1Title, desc: t.tutAdm1Desc, icon: <Users size={48} className="text-brand-600" /> },
    { title: t.tutAdm2Title, desc: t.tutAdm2Desc, icon: <div className="bg-gray-100 p-2 rounded font-mono text-sm border-2 border-brand-200">CODE: 123456</div> },
    { title: t.tutAdm3Title, desc: t.tutAdm3Desc, icon: <Calendar size={48} className="text-orange-500" /> },
    { title: t.tutAdm4Title, desc: t.tutAdm4Desc, icon: <Download size={48} className="text-green-600" /> },
  ] : [
    { title: t.tutEmp1Title, desc: t.tutEmp1Desc, icon: <Clock size={48} className="text-brand-600" /> },
    { title: t.tutEmp2Title, desc: t.tutEmp2Desc, icon: <div className="bg-brand-600 text-white p-3 rounded-full"><Clock size={32} /></div> },
    { title: t.tutEmp3Title, desc: t.tutEmp3Desc, icon: <Sparkles size={48} className="text-purple-600" /> },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onComplete();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative flex flex-col min-h-[400px]">
        <button onClick={onComplete} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 p-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t.tutSkip}</span>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-8">
            <div className="mb-6 p-6 bg-gray-50 rounded-full shadow-inner animate-[bounce_2s_infinite]">
                {steps[step].icon}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{steps[step].title}</h2>
            <p className="text-gray-500 leading-relaxed">{steps[step].desc}</p>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-center gap-2 mb-6">
                {steps.map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-brand-600' : 'w-2 bg-gray-300'}`} />
                ))}
            </div>
            
            <div className="flex justify-between items-center">
                <button 
                    onClick={handlePrev} 
                    disabled={step === 0}
                    className={`p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    <ChevronLeft size={24} />
                </button>

                <button 
                    onClick={handleNext} 
                    className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2"
                >
                    {step === steps.length - 1 ? t.tutFinish : t.tutNext}
                    {step !== steps.length - 1 && <ChevronRight size={18} />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
