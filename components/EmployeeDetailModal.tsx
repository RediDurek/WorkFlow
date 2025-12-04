'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { User, TimeLog, LeaveRequest, Language, LeaveType, TimeAdjustment } from '../types';
import { translations } from '../constants/translations';
import { X, Calendar, Clock, AlertCircle, Mail, User as UserIcon, Download } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { buildDayAggregates } from '../lib/timeUtils';
import { formatDate, formatHours } from '../lib/format';

interface EmployeeDetailModalProps {
  user: User;
  logs: TimeLog[];
  leaves: LeaveRequest[];
  adjustments?: TimeAdjustment[];
  defaultMonth?: number;
  defaultYear?: number;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onUpdateContract?: (contractType: 'DETERMINATO' | 'INDETERMINATO', contractEndDate?: string) => Promise<void>;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ user, logs, leaves, adjustments = [], defaultMonth, defaultYear, isOpen, onClose, language, onUpdateContract }) => {
  const t = translations[language];
  if (!isOpen) return null;

  const locale = language === 'EN' ? 'en-US' : language.toLowerCase();

  const [contractType, setContractType] = useState<'DETERMINATO' | 'INDETERMINATO'>(user.contractType || 'INDETERMINATO');
  const [contractEnd, setContractEnd] = useState<string>(user.contractEndDate || '');
  const [savingContract, setSavingContract] = useState(false);
  const [showAllLeaves, setShowAllLeaves] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth ?? new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear ?? new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(0);

  useEffect(() => {
    setContractType(user.contractType || 'INDETERMINATO');
    setContractEnd(user.contractEndDate || '');
  }, [user]);

  // Stats Calculation
  const totalLeaves = leaves.length;
  const sickDays = leaves.filter(l => l.type === LeaveType.SICK).length;
  const permitDays = leaves.filter(l => l.type === LeaveType.PERMIT).length;
  const vacationDays = leaves.filter(l => l.type === LeaveType.VACATION).length;

  // --- Hours aggregation (no raw logs shown) ---
  const timeAggregation = useMemo(() => {
    // Adjustments approvate sono già riflesse nei time_logs lato server; usiamo solo i log
    const monthLogs = logs
      .filter(l => {
        const d = new Date(l.dateString);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const dayMap = buildDayAggregates(monthLogs);
    const days = Array.from(dayMap.entries())
      .map(([dateKey, entry]) => ({ dateKey, ms: entry.totalMs, day: new Date(dateKey).getDate() }))
      .sort((a, b) => a.day - b.day);

    const weeksMap = new Map<number, { label: string; ms: number; days: typeof days }>();
    days.forEach(d => {
      const weekIdx = Math.floor((d.day - 1) / 7);
      if (!weeksMap.has(weekIdx)) {
        const startDay = weekIdx * 7 + 1;
        const endDay = Math.min(startDay + 6, new Date(selectedYear, selectedMonth + 1, 0).getDate());
        weeksMap.set(weekIdx, { label: `Settimana ${weekIdx + 1} (${startDay}-${endDay})`, ms: 0, days: [] });
      }
      const week = weeksMap.get(weekIdx)!;
      week.ms += d.ms;
      week.days.push(d);
    });
    const weeks = Array.from(weeksMap.entries()).sort((a, b) => a[0] - b[0]).map(([idx, val]) => ({ idx, ...val }));
    const monthTotal = days.reduce((acc, d) => acc + d.ms, 0);
    const activeWeek = weeks.find(w => w.idx === selectedWeek) || weeks[0];

    return {
      weeks,
      monthTotal,
      activeWeek
    };
  }, [logs, selectedMonth, selectedYear, selectedWeek]);

  useEffect(() => {
    setSelectedWeek(0);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (defaultMonth !== undefined) setSelectedMonth(defaultMonth);
    if (defaultYear !== undefined) setSelectedYear(defaultYear);
  }, [defaultMonth, defaultYear]);

  const handleDownloadReport = async () => {
    const docContent = await StorageService.exportDataAsDoc(user.id, user.orgId, selectedMonth, selectedYear, language, [user]);
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString(language === 'EN' ? 'en-US' : language.toLowerCase(), { month: 'long' });
    link.href = url;
    link.setAttribute('download', `Report_${user.name}_${selectedYear}_${monthName}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDayLabel = (dateKey: string) => {
    const d = new Date(dateKey);
    return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
  };
  
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
           <div className="flex items-center gap-2">
             <button onClick={handleDownloadReport} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-brand-600 bg-white border border-brand-100 rounded-lg hover:bg-brand-50">
               <Download size={16} /> Scarica report
             </button>
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={24} /></button>
           </div>
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
                    const hasContract = !!user.contractType;
                    const type = user.contractType || 'INDETERMINATO';
                    const end = user.contractEndDate ? new Date(user.contractEndDate) : null;
                    let daysLeft: number | null = null;
                    if (hasContract && type === 'DETERMINATO' && end) {
                      daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    }
                    const isExpiring = daysLeft !== null && daysLeft <= 30;
                    const badgeColor = !hasContract ? 'bg-gray-100 text-gray-700' : type === 'INDETERMINATO' ? 'bg-green-100 text-green-700' : isExpiring ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800';
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-gray-500 uppercase">Contratto</div>
                          <div className="text-sm text-gray-800">
                            {!hasContract ? t.contractMissing : type === 'INDETERMINATO' ? 'Indeterminato' : 'Determinato'}
                            {hasContract && type === 'DETERMINATO' && end && (
                              <span className="ml-2 text-gray-500">Scadenza: {formatDate(end.getTime())}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                          {!hasContract ? t.contractMissing : type === 'INDETERMINATO' ? 'Indeterminato' : daysLeft !== null ? `Scade in ${daysLeft} gg` : 'Determinato'}
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Clock size={20} className="text-brand-600" /> {t.leaveHistory}</h3>
              {leaves.length > 2 && (
                <button onClick={() => setShowAllLeaves(!showAllLeaves)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  {showAllLeaves ? 'Nascondi' : 'Vedi tutto'}
                </button>
              )}
            </div>
            <div className="space-y-3">
                {leaves.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 italic">Nessuna richiesta trovata.</p>
                ) : (
                    (showAllLeaves ? leaves : leaves.slice(0, 2)).map(l => (
                        <div key={l.id} className="bg-white border border-gray-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.type === LeaveType.SICK ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{l.type}</span>
                                    <span className="text-xs font-medium text-gray-500">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</span>
                                </div>
                                <div className="text-sm text-gray-800 italic line-clamp-2">"{l.reason}"</div>
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

            {/* Weekly Hours Report */}
            <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase">{t.totalHours}</div>
                  <div className="text-2xl font-extrabold text-gray-900">{formatHours(timeAggregation.monthTotal)} h</div>
                  <div className="text-xs text-gray-400">Totale mese selezionato</div>
                </div>
                <div className="flex gap-2">
                  <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {t.months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {Array.from({length: 5}, (_, idx) => new Date().getFullYear() - idx).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {timeAggregation.weeks.length > 0 && (
                    <select value={selectedWeek} onChange={e => setSelectedWeek(parseInt(e.target.value))} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {timeAggregation.weeks.map(w => (
                        <option key={w.idx} value={w.idx}>{w.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {timeAggregation.activeWeek ? (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 flex justify-between">
                    <span>{timeAggregation.activeWeek.label}</span>
                    <span>{formatHours(timeAggregation.activeWeek.ms)} h</span>
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {timeAggregation.activeWeek.days.length === 0 ? (
                        <tr><td className="px-4 py-3 text-sm text-gray-400 text-center">Nessuna attività registrata</td></tr>
                      ) : (
                        timeAggregation.activeWeek.days.map((d, idx) => (
                          <tr key={d.dateKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatDayLabel(d.dateKey)}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatHours(d.ms)} h</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-brand-50">
                        <td className="px-4 py-3 text-sm font-bold text-brand-900">Totale settimana</td>
                        <td className="px-4 py-3 text-sm text-right font-extrabold text-brand-900">{formatHours(timeAggregation.activeWeek.ms)} h</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-4">Nessuna attività nel periodo selezionato.</div>
              )}
            </div>

        </div>
      </div>
    </div>
  );
};
