'use client';

import React, { useEffect, useState } from 'react';
import { User, TimeLog, LeaveRequest, Language, LeaveType } from '../types';
import { translations } from '../constants/translations';
import { X, Calendar, Clock, AlertCircle, Mail, User as UserIcon } from 'lucide-react';

interface EmployeeDetailModalProps {
  user: User;
  logs: TimeLog[];
  leaves: LeaveRequest[];
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onUpdateContract?: (contractType: 'DETERMINATO' | 'INDETERMINATO', contractEndDate?: string) => Promise<void>;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ user, logs, leaves, isOpen, onClose, language, onUpdateContract }) => {
  const t = translations[language];
  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
      const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
      return new Date(timestamp).toLocaleDateString(locale);
  };

  const [contractType, setContractType] = useState<'DETERMINATO' | 'INDETERMINATO'>(user.contractType || 'INDETERMINATO');
  const [contractEnd, setContractEnd] = useState<string>(user.contractEndDate || '');
  const [savingContract, setSavingContract] = useState(false);

  useEffect(() => {
    setContractType(user.contractType || 'INDETERMINATO');
    setContractEnd(user.contractEndDate || '');
  }, [user]);

  // Stats Calculation
  const totalLeaves = leaves.length;
  const sickDays = leaves.filter(l => l.type === LeaveType.SICK).length;
  const permitDays = leaves.filter(l => l.type === LeaveType.PERMIT).length;
  const vacationDays = leaves.filter(l => l.type === LeaveType.VACATION).length;
  
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <div className="flex items-center gap-4">
              <div className="bg-brand-100 p-3 rounded-full text-brand-600"><UserIcon size={24} /></div>
              <div>
                  <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                  <p className="text-sm text-gray-500 font-mono">{user.taxId || "NO TAX ID"}</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            
            {/* Contact Info */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{t.contactInfo}</h3>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg flex-1"><Mail size={16} /> {user.email}</div>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg flex-1"><Calendar size={16} /> {t.joinedDate}: {formatDate(user.createdAt)}</div>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                  {(() => {
                    const type = user.contractType || 'INDETERMINATO';
                    const end = user.contractEndDate ? new Date(user.contractEndDate) : null;
                    let daysLeft: number | null = null;
                    if (type === 'DETERMINATO' && end) {
                      daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    }
                    const isExpiring = daysLeft !== null && daysLeft <= 30;
                    const badgeColor = type === 'INDETERMINATO' ? 'bg-green-100 text-green-700' : isExpiring ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800';
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-gray-500 uppercase">Contratto</div>
                          <div className="text-sm text-gray-800">
                            {type === 'INDETERMINATO' ? 'Indeterminato' : 'Determinato'}
                            {type === 'DETERMINATO' && end && (
                              <span className="ml-2 text-gray-500">Scadenza: {formatDate(end.getTime())}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                          {type === 'INDETERMINATO' ? 'Indeterminato' : daysLeft !== null ? `Scade in ${daysLeft} gg` : 'Determinato'}
                        </span>
                      </div>
                    );
                  })()}

                  {onUpdateContract && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                      <div className="md:col-span-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Tipo</label>
                        <select value={contractType} onChange={e => setContractType(e.target.value as any)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                          <option value="INDETERMINATO">Indeterminato</option>
                          <option value="DETERMINATO">Determinato</option>
                        </select>
                      </div>
                      {contractType === 'DETERMINATO' && (
                        <div className="md:col-span-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Scadenza</label>
                          <input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                        </div>
                      )}
                      <div className="md:col-span-1">
                        <button
                          onClick={async () => {
                            if (!onUpdateContract) return;
                            setSavingContract(true);
                            await onUpdateContract(contractType, contractEnd || undefined);
                            setSavingContract(false);
                          }}
                          className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-brand-700 disabled:opacity-60"
                          disabled={savingContract}
                        >
                          {savingContract ? 'Salvataggio...' : 'Salva contratto'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Stats Overview */}
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><AlertCircle size={20} className="text-brand-600" /> {t.statsOverview}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <div className="text-2xl font-bold text-gray-800">{totalLeaves}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">{t.totalLeaves}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                    <div className="text-2xl font-bold text-red-600">{sickDays}</div>
                    <div className="text-[10px] uppercase font-bold text-red-400">{t.sickDays}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
                    <div className="text-2xl font-bold text-orange-600">{permitDays}</div>
                    <div className="text-[10px] uppercase font-bold text-orange-400">{t.permitDays}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
                    <div className="text-2xl font-bold text-blue-600">{vacationDays}</div>
                    <div className="text-[10px] uppercase font-bold text-blue-400">{t.vacationDays}</div>
                </div>
            </div>

            {/* Leave History */}
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><Clock size={20} className="text-brand-600" /> {t.leaveHistory}</h3>
            <div className="space-y-3">
                {leaves.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 italic">Nessuna richiesta trovata.</p>
                ) : (
                    leaves.map(l => (
                        <div key={l.id} className="bg-white border border-gray-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.type === LeaveType.SICK ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{l.type}</span>
                                    <span className="text-xs font-medium text-gray-500">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</span>
                                </div>
                                <div className="text-sm text-gray-800 italic">"{l.reason}"</div>
                            </div>
                            <div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${l.status === 'APPROVED' ? 'bg-green-100 text-green-700' : l.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {l.status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

        </div>
      </div>
    </div>
  );
};
