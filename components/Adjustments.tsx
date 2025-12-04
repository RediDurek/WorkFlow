'use client';

import React, { useEffect, useState } from 'react';
import { Language, TimeAdjustment, TimeLog, User } from '../types';
import { computeNetHours } from '../lib/timeUtils';
import { StorageService } from '../services/storageService';
import { translations } from '../constants/translations';
import { Plus, Send, Check, X, AlertTriangle, ClipboardList } from 'lucide-react';

interface AdjustmentsProps {
  user: User;
  language: Language;
  refreshCounts?: () => void;
}

export const Adjustments: React.FC<AdjustmentsProps> = ({ user, language, refreshCounts }) => {
  const t = translations[language];
  const [adjustments, setAdjustments] = useState<TimeAdjustment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [clockInOld, setClockInOld] = useState('');
  const [clockOutOld, setClockOutOld] = useState('');
  const [pauseStart, setPauseStart] = useState('');
  const [pauseEnd, setPauseEnd] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const formatTime = (v?: string) => v && v.length >= 4 ? v : '-';
  const getNetHours = (day: string, cin?: string, cout?: string, ps?: string, pe?: string) => computeNetHours(day, cin, cout, ps, pe);
  const availableDays = Array.from(new Set(logs.map(l => l.dateString))).sort().reverse();
  const getDaySummary = (day: string) => {
    const dayLogs = logs.filter(l => l.dateString === day).sort((a, b) => a.timestamp - b.timestamp);
    const firstIn = dayLogs.find(l => l.type === 'CLOCK_IN' || l.type === 'END_BREAK');
    const lastOut = [...dayLogs].reverse().find(l => l.type === 'CLOCK_OUT' || l.type === 'START_BREAK');
    const toTime = (ts?: number) => ts ? new Date(ts).toISOString().substring(11,16) : '';
    return { clockIn: toTime(firstIn?.timestamp), clockOut: toTime(lastOut?.timestamp) };
  };

  useEffect(() => {
    if (date && user.role === 'EMPLOYEE') {
    const summary = getDaySummary(date);
    setClockInOld(summary.clockIn);
    setClockOutOld(summary.clockOut);
    setClockIn(summary.clockIn || '');
    setClockOut(summary.clockOut || '');
    setPauseStart('');
    setPauseEnd('');
  }
  }, [date, user.role]);

  const load = async () => {
    const data = await StorageService.getAdjustments(user.role === 'ADMIN' ? undefined : user.id);
    // StorageService già restituisce campi in camelCase normalizzati
    setAdjustments(data);
  };

  useEffect(() => {
    load();
    if (user.role === 'EMPLOYEE') {
      StorageService.getLogs(user.id).then(setLogs);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !clockIn || !clockOut || !reason) return;
    setLoading(true);
    try {
      await StorageService.createAdjustment({ date, clockInOld, clockOutOld, clockInNew: clockIn, clockOutNew: clockOut, pauseStart, pauseEnd, reason });
      setShowForm(false);
      setDate(''); setClockIn(''); setClockOut(''); setReason('');
      setClockInOld(''); setClockOutOld('');
      setPauseStart(''); setPauseEnd('');
      await load();
      refreshCounts && refreshCounts();
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleDecision = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await StorageService.updateAdjustmentStatus(id, status);
    await load();
    refreshCounts && refreshCounts();
  };

  const pendingAdjustments = adjustments.filter(a => a.status === 'PENDING');

  return (
    <div className="max-w-3xl mx-auto w-full pt-safe px-4 pb-24">
      <header className="flex justify-between items-center mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Correzioni ore</h1>
          <p className="text-gray-500 text-sm">{user.role === 'ADMIN' ? 'Gestisci le richieste di correzione' : 'Richiedi una correzione se ti sei dimenticato di timbrare'}</p>
        </div>
        {user.role === 'EMPLOYEE' && (
          <button onClick={() => setShowForm(true)} className="bg-brand-600 text-white p-3 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-transform">
            <Plus size={24} />
          </button>
        )}
      </header>

      {user.role === 'EMPLOYEE' && showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ClipboardList size={18} className="text-brand-600" /> Nuova correzione</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Giorno (già registrato)</label>
                <select value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <option value="" disabled>Seleziona un giorno timbrato</option>
                  {availableDays.map(d => (
                    <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                  ))}
                </select>
                {availableDays.length === 0 && <div className="text-[11px] text-red-500 mt-1">Nessun giorno timbrato disponibile</div>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Ingresso</label>
                <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                {clockInOld && <div className="text-[10px] text-gray-400 mt-1">Attuale: {clockInOld}</div>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Uscita</label>
                <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                {clockOutOld && <div className="text-[10px] text-gray-400 mt-1">Attuale: {clockOutOld}</div>}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Motivo</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 h-20 resize-none" placeholder="Es. dimenticato il badge, uscita anticipata..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Pausa (inizio)</label>
                <input type="time" value={pauseStart} onChange={e => setPauseStart(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Pausa (fine)</label>
                <input type="time" value={pauseEnd} onChange={e => setPauseEnd(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annulla</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-60">
                {loading ? 'Invio...' : <span className="flex items-center gap-2"><Send size={16} /> Invia</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {user.role === 'ADMIN' && pendingAdjustments.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-yellow-900 font-bold mb-3"><AlertTriangle size={18} /> In attesa di approvazione ({pendingAdjustments.length})</div>
          <div className="space-y-3">
            {pendingAdjustments.map(a => (
              <div key={a.id} className="bg-white border border-yellow-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-gray-900">{new Date(a.date).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-500"><span className="font-semibold text-gray-700">Prima:</span> {formatTime(a.clockInOld)} / {formatTime(a.clockOutOld)}</div>
                  <div className="text-xs text-gray-500"><span className="font-semibold text-gray-700">Dopo:</span> {formatTime(a.clockInNew || a.clockIn)} / {formatTime(a.clockOutNew || a.clockOut)}</div>
                  {(a.pauseStartNew || a.pauseEndNew || a.pauseStart || a.pauseEnd) ? (
                    <div className="text-[11px] text-gray-500">Pausa: {formatTime(a.pauseStartNew || a.pauseStart)} - {formatTime(a.pauseEndNew || a.pauseEnd)}</div>
                  ) : (
                    <div className="text-[11px] text-gray-400">Pausa: nessuna</div>
                  )}
                  <div className="text-[11px] text-gray-500">Netto proposto: {(() => {
                    const h = getNetHours(a.date, a.clockInNew || a.clockIn, a.clockOutNew || a.clockOut, a.pauseStartNew || a.pauseStart, a.pauseEndNew || a.pauseEnd);
                    return h !== null ? `${h.toFixed(2)} h` : 'n/d';
                  })()}</div>
                  <div className="text-xs text-gray-600 mt-1">Motivo: {a.reason}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDecision(a.id, 'REJECTED')} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 flex items-center gap-1"><X size={16} /> Rifiuta</button>
                  <button onClick={() => handleDecision(a.id, 'APPROVED')} className="px-3 py-2 rounded-lg bg-green-50 text-green-700 flex items-center gap-1"><Check size={16} /> Approva</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><ClipboardList size={18} className="text-brand-600" /> Storico richieste</h3>
          <span className="text-xs text-gray-400">Totale: {adjustments.length}</span>
        </div>
        {adjustments.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">Nessuna richiesta di correzione.</div>
        ) : (
          <div className="space-y-2">
            {adjustments.map(a => (
              <div key={a.id} className="border border-gray-100 rounded-xl p-3 flex justify-between items-start bg-gray-50">
                <div>
                  <div className="text-sm font-bold text-gray-900">{new Date(a.date).toLocaleDateString()} ? {formatTime(a.clockInNew || a.clockIn)} - {formatTime(a.clockOutNew || a.clockOut)}</div>
                  {(a.clockInOld || a.clockOutOld) && (
                    <div className="text-[11px] text-gray-500">Prima: {formatTime(a.clockInOld)} - {formatTime(a.clockOutOld)}</div>
                  )}
                  {(a.pauseStartNew || a.pauseEndNew || a.pauseStart || a.pauseEnd) ? (
                    <div className="text-[11px] text-gray-500">Pausa: {formatTime(a.pauseStartNew || a.pauseStart)} - {formatTime(a.pauseEndNew || a.pauseEnd)}</div>
                  ) : (
                    <div className="text-[11px] text-gray-400">Pausa: nessuna</div>
                  )}
                  <div className="text-[11px] text-gray-500">Netto approvato: {(() => {
                    const h = getNetHours(a.date, a.clockInNew || a.clockIn, a.clockOutNew || a.clockOut, a.pauseStartNew || a.pauseStart, a.pauseEndNew || a.pauseEnd);
                    return h !== null ? `${h.toFixed(2)} h` : 'n/d';
                  })()}</div>
                  <div className="text-xs text-gray-600 mt-1">Motivo: {a.reason}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Richiesta il {new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  a.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                  a.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {a.status}
                </span>
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
};
