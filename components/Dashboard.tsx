'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, Coffee, Briefcase, Users, Building, Copy, Clock, CalendarCheck, MapPin, Loader2, Check, X, UserPlus, ShieldAlert, Download, Crown, Lock, RefreshCw, Trash2, Eye } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { WorkStatus, LogType, TimeLog, User, UserStats, Organization, Language, LeaveType } from '../types';
import { SubscriptionModal } from './SubscriptionModal';
import { OnboardingTutorial } from './OnboardingTutorial';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import { translations } from '../constants/translations';
import { buildDayAggregates } from '../lib/timeUtils';

// Fallback UUID generator for environments where crypto.randomUUID is not available
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate a v4 UUID manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface DashboardProps {
  user: User;
  language: Language;
  refreshUser: () => void;
  onOpenLeave?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, language, refreshUser, onOpenLeave }) => {
  const t = translations[language];

  // --- STATE ---
  const [status, setStatus] = useState<WorkStatus>(WorkStatus.IDLE);
  const [lastLog, setLastLog] = useState<TimeLog | undefined>(undefined);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");
  const [todayLogs, setTodayLogs] = useState<TimeLog[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  const [orgEmployees, setOrgEmployees] = useState<UserStats[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [pendingContracts, setPendingContracts] = useState<User[]>([]);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [orgAdjustments, setOrgAdjustments] = useState<any[]>([]);
  const [orgCode, setOrgCode] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [orgDetails, setOrgDetails] = useState<Organization | undefined>(undefined);

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionMode, setSubscriptionMode] = useState<'TRIAL_SETUP' | 'UPGRADE'>('UPGRADE');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const [showTutorial, setShowTutorial] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  // Export & Filter State
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth());
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());

  // Employee Detail Modal
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedEmpLogs, setSelectedEmpLogs] = useState<TimeLog[]>([]);
  const [selectedEmpLeaves, setSelectedEmpLeaves] = useState<any[]>([]);
  const [selectedEmpAdjustments, setSelectedEmpAdjustments] = useState<any[]>([]);

  // Helper for locale
  const getLocale = () => {
     if(language === 'EN') return 'en-US';
     return language.toLowerCase();
  };

  // --- LOGIC ---
  useEffect(() => {
     if (user.hasSeenTutorial === false) {
         setShowTutorial(true);
     }
  }, []);

  const handleTutorialComplete = async () => {
      setShowTutorial(false);
       await StorageService.completeTutorial();
       refreshUser();
   };

  const calculateUserStats = (user: User, logs: TimeLog[], adjustments: any[], month: number, year: number): UserStats => {
    const userId = user.id;
    // 1. Get ALL logs for current status (Last log check needs history); adjustments are already reflected in logs
    const allUserLogs = logs.filter(l => l.userId === userId).sort((a,b) => a.timestamp - b.timestamp);

    const last = allUserLogs.length > 0 ? allUserLogs[allUserLogs.length - 1] : undefined;
    let currentStatus = WorkStatus.IDLE;
    let currentLocation = undefined;

    if (last) {
        if (last.type === LogType.CLOCK_IN || last.type === LogType.END_BREAK) {
            currentStatus = WorkStatus.WORKING;
            const lastClockIn = [...allUserLogs].reverse().find(l => l.type === LogType.CLOCK_IN);
            if (lastClockIn) currentLocation = lastClockIn.location;
        }
        else if (last.type === LogType.START_BREAK) currentStatus = WorkStatus.ON_BREAK;
    }

    // 2. Filter logs strictly for selected month/year using date string to avoid TZ drift
    const monthlyLogs = allUserLogs.filter(l => {
      const d = new Date(l.dateString);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const dayAgg = buildDayAggregates(monthlyLogs);
    const totalMs = Array.from(dayAgg.values()).reduce((acc, v) => acc + v.totalMs, 0);
    const daysSet = new Set(dayAgg.keys());
    
    return {
        userId, userName: user.name, taxId: user.taxId, currentStatus, lastActive: last ? last.timestamp : 0,
        totalHours: totalMs / (1000 * 60 * 60), daysWorked: daysSet.size, currentLocation, userStatus: user.status
    };
  };

  const refreshData = useCallback(async () => {
    const org = await StorageService.getOrganization(user.orgId);
    setOrgDetails(org);

    if (org && user.role === 'ADMIN') {
        if (org.subscriptionStatus === 'TRIAL' && !org.paymentMethodLinked) {
            setSubscriptionMode('TRIAL_SETUP');
            setShowSubscriptionModal(true);
        }
        if (org.subscriptionStatus === 'TRIAL') {
            const daysLeft = Math.ceil((org.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24));
            setTrialDaysLeft(daysLeft > 0 ? daysLeft : 0);
            if (daysLeft <= 0) {
                 setSubscriptionMode('UPGRADE');
                 setShowSubscriptionModal(true);
            }
        } else if (org.subscriptionStatus === 'EXPIRED') {
            setTrialDaysLeft(0);
            setSubscriptionMode('UPGRADE');
            setShowSubscriptionModal(true);
        } else {
            setTrialDaysLeft(null);
        }
    }

    if (user.role === 'EMPLOYEE') {
        const logs = await StorageService.getLogs(user.id);
        const last = logs.length > 0 ? logs[logs.length - 1] : undefined;
        setLastLog(last);
        const todayStr = new Date().toISOString().split('T')[0];
        setTodayLogs(logs.filter(l => l.dateString === todayStr));
        if (!last) setStatus(WorkStatus.IDLE);
        else if (last.type === LogType.CLOCK_IN || last.type === LogType.END_BREAK) setStatus(WorkStatus.WORKING);
        else if (last.type === LogType.START_BREAK) setStatus(WorkStatus.ON_BREAK);
        else setStatus(WorkStatus.IDLE);
    } else {
        if (org) { setOrgCode(org.code); setOrgName(org.name); }
        const allUsers = await StorageService.getOrgEmployees(user.orgId);
        setOrgUsers(allUsers);
        const activeEmployees = allUsers.filter(u => u.status === 'ACTIVE');
        const pending = allUsers.filter(u => u.status === 'PENDING_APPROVAL');
        const pendingContractList = allUsers.filter(u => u.status === 'PENDING_CONTRACT');
        setPendingUsers(pending);
        setPendingContracts(pendingContractList);
        const allLogs = await StorageService.getLogs(undefined, user.orgId);
        const allAdjustments = await StorageService.getAdjustments();
        setOrgAdjustments(allAdjustments);
        
        // Use exportMonth/Year to filter stats
        const stats: UserStats[] = activeEmployees.map(emp => {
            return calculateUserStats(emp, allLogs, allAdjustments, exportMonth, exportYear);
        });
        setOrgEmployees(stats);
    }
  }, [user, exportMonth, exportYear]); // Depend on filter changes

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (user.role === 'EMPLOYEE' && status !== WorkStatus.IDLE && lastLog) {
      interval = setInterval(() => {
        const now = Date.now();
        const start = lastLog.timestamp;
        const diff = now - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const pad = (n: number) => n.toString().padStart(2, '0');
        setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }, 1000);
    } else {
      setElapsedTime("00:00:00");
    }
    return () => clearInterval(interval);
  }, [status, lastLog, user.role]);

  const handleApproveUser = async (userId: string) => {
     if (orgDetails?.subscriptionStatus === 'EXPIRED') {
         setSubscriptionMode('UPGRADE');
         setShowSubscriptionModal(true);
         return;
     }
     await StorageService.updateUserStatus(user.id, userId, 'ACTIVE');
     refreshData();
  };

  const handleRejectUser = async (userId: string) => {
     if(confirm('Confirm reject?')) {
        await StorageService.updateUserStatus(user.id, userId, 'BLOCKED');
        refreshData();
     }
  };

  const handleRegenerateCode = async () => {
      setRegeneratingCode(true);
      const newCode = await StorageService.regenerateOrgCode();
      if (newCode) {
          setOrgCode(newCode);
          alert(t.codeRegenerated);
      }
      setRegeneratingCode(false);
  };
  
  const handleDeleteEmployee = async (e: React.MouseEvent, empId: string) => {
      e.stopPropagation();
      if (confirm(t.confirmDeleteEmp)) {
          await StorageService.removeUserFromOrg(empId);
          refreshData();
      }
  };

  const handleOpenEmployeeDetail = async (empId: string) => {
      const allUsers = await StorageService.getOrgEmployees(user.orgId);
      const emp = allUsers.find((u: User) => u.id === empId);
      if (emp) {
          const allLogs = await StorageService.getLogs(empId);
          const allLeaves = await StorageService.getLeaveRequests(empId);
          const allAdjustments = await StorageService.getAdjustments(empId);
          setSelectedEmployee(emp);
          setSelectedEmpLogs(allLogs);
          setSelectedEmpLeaves(allLeaves);
          setSelectedEmpAdjustments(allAdjustments);
      }
  };

  const handleUpdateContract = async (empId: string, type: 'DETERMINATO' | 'INDETERMINATO', endDate?: string) => {
    await StorageService.updateContractInfo(empId, type, endDate);
    const allUsers = await StorageService.getOrgEmployees(user.orgId);
    setOrgUsers(allUsers);
    setPendingContracts(allUsers.filter(u => u.status === 'PENDING_CONTRACT'));
    const allAdjustments = await StorageService.getAdjustments();
    setOrgAdjustments(allAdjustments);
    const refreshed = allUsers.find((u: User) => u.id === empId);
    if (refreshed) setSelectedEmployee(refreshed);
    refreshData();
  };

  const handleDownloadSingleReport = async (empId: string) => {
     const docContent = await StorageService.exportDataAsDoc(empId, user.orgId, exportMonth, exportYear, language, orgUsers);
     const blob = new Blob([docContent], { type: 'application/msword' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     const monthName = new Date(exportYear, exportMonth).toLocaleString('default', { month: 'long' });
     link.href = url;
     link.setAttribute('download', `Report_${monthName}_${exportYear}_${empId}.doc`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleExportDoc = async () => {
    if (!orgDetails?.isPro || orgDetails?.subscriptionStatus === 'EXPIRED') {
        setSubscriptionMode('UPGRADE');
        setShowSubscriptionModal(true);
        return;
    }
    const docContent = await StorageService.exportDataAsDoc(undefined, user.orgId, exportMonth, exportYear, language, orgUsers);
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const monthName = new Date(exportYear, exportMonth).toLocaleString(language === 'EN' ? 'en-US' : language.toLowerCase(), { month: 'long' });
    link.setAttribute('download', `Report_${exportYear}_${monthName}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAction = async (type: LogType) => {
    if (orgDetails?.subscriptionStatus === 'EXPIRED') {
        setShowSubscriptionModal(true);
        return;
    }
    let locationName: string | undefined = undefined;
    if (type === LogType.CLOCK_IN) {
      setIsLocating(true);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 0
          });
        });
        const getCity = async (lat: number, lon: number) => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
                const data = await res.json();
                return data.address.city || data.address.town || data.address.village || "Unknown";
            } catch { return "N/A"; }
        };
        locationName = await getCity(position.coords.latitude, position.coords.longitude);
      } catch (error) { locationName = "N/A"; } finally { setIsLocating(false); }
    }
    const newLog: TimeLog = {
      id: generateUUID(), userId: user.id, orgId: user.orgId, timestamp: Date.now(),
      type, dateString: new Date().toISOString().split('T')[0], location: locationName
    };
    await StorageService.addLog(newLog);
    refreshData();
  };
  
  const renderTrialBanner = () => {
      if (trialDaysLeft !== null && trialDaysLeft > 0) {
          return (
              <div className="bg-brand-600 text-white text-sm py-2 px-4 text-center font-medium shadow-md sticky top-0 z-40">
                 🎉 {t.trialBanner}: <strong>{trialDaysLeft} {t.daysLeft}</strong>.
              </div>
          );
      }
      if (orgDetails?.subscriptionStatus === 'EXPIRED') {
           return (
              <div className="bg-red-600 text-white text-sm py-2 px-4 text-center font-bold shadow-md sticky top-0 z-40 animate-pulse flex items-center justify-center gap-2">
                 <Lock size={16} /> ⛔ {t.expiredBanner}
              </div>
          );
      }
      return null;
  };

  const isExpired = orgDetails?.subscriptionStatus === 'EXPIRED';

  // --- EMPLOYEE VIEW ---
  if (user.role === 'EMPLOYEE') {
      const getStatusColor = () => {
        switch (status) {
          case WorkStatus.WORKING: return "bg-green-50 text-green-700 border-green-200";
          case WorkStatus.ON_BREAK: return "bg-orange-50 text-orange-700 border-orange-200";
          default: return "bg-gray-50 text-gray-500 border-gray-200";
        }
    };
    const getStatusText = () => {
        switch (status) {
          case WorkStatus.WORKING: return t.statusWorking;
          case WorkStatus.ON_BREAK: return t.statusBreak;
          default: return t.statusIdle;
        }
    };

    return (
        <div className="h-full flex flex-col relative">
            {showTutorial && <OnboardingTutorial user={user} language={language} onComplete={handleTutorialComplete} />}
            {isExpired && <div className="absolute inset-0 bg-white/80 z-30 backdrop-blur-sm" />}
            {renderTrialBanner()}
            
            <div className="max-w-md mx-auto w-full pt-safe px-4 pb-24 flex-1 overflow-y-auto no-scrollbar">
            <header className="mb-8 text-center mt-6">
                <h1 className="text-2xl font-bold text-gray-800">{t.welcome}, {user.name}</h1>
            </header>

        
            <div className={`mb-8 p-6 rounded-3xl border-2 flex flex-col items-center justify-center shadow-sm transition-all ${getStatusColor()}`}>
                <div className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-2">{t.empStatus}</div>
                <div className="text-3xl font-bold mb-4">{getStatusText()}</div>
                <div className="text-5xl font-mono font-medium tracking-tight tabular-nums">{elapsedTime}</div>
                {status === WorkStatus.WORKING && lastLog?.location && (
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium opacity-80 bg-white/50 px-3 py-1 rounded-full">
                    <MapPin size={14} /> {lastLog.location}
                </div>
                )}
            </div>
        
            <div className="grid grid-cols-2 gap-4 mb-8">
                {status === WorkStatus.IDLE && (
                <button
                    onClick={() => handleAction(LogType.CLOCK_IN)}
                    disabled={isLocating || isExpired}
                    className="col-span-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white p-6 rounded-2xl shadow-lg shadow-brand-200 flex flex-col items-center justify-center transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                    {isLocating ? <Loader2 size={32} className="mb-2 animate-spin" /> : <Play size={32} className="mb-2" />}
                    <span className="font-bold text-lg">{isLocating ? t.locating : t.btnStart}</span>
                </button>
                )}
                {status === WorkStatus.WORKING && (
                <>
                    <button onClick={() => handleAction(LogType.START_BREAK)} disabled={isExpired} className="bg-orange-100 text-orange-700 active:scale-95 p-6 rounded-2xl flex flex-col items-center justify-center font-bold">
                    <Coffee size={32} className="mb-2" /> {t.btnPause}
                    </button>
                    <button onClick={() => handleAction(LogType.CLOCK_OUT)} disabled={isExpired} className="bg-red-100 text-red-700 active:scale-95 p-6 rounded-2xl flex flex-col items-center justify-center font-bold">
                    <Square size={32} className="mb-2" /> {t.btnStop}
                    </button>
                </>
                )}
                {status === WorkStatus.ON_BREAK && (
                <button onClick={() => handleAction(LogType.END_BREAK)} disabled={isExpired} className="col-span-2 bg-brand-600 text-white p-6 rounded-2xl flex flex-col items-center justify-center font-bold text-lg">
                    <Briefcase size={32} className="mb-2" /> {t.btnResume}
                </button>
                )}
            </div>
        
            <div className="">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.todayActivity}</h3>
                <div className="space-y-3">
                {todayLogs.length === 0 ? <p className="text-gray-400 text-center text-sm py-4">{t.noActivity}</p> : 
                    [...todayLogs].reverse().map((log) => (
                    <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${log.type === LogType.CLOCK_IN || log.type === LogType.END_BREAK ? 'bg-green-100 text-green-600' : (log.type === LogType.START_BREAK ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600')}`}>
                                {log.type === LogType.CLOCK_IN && <Play size={16} />}
                                {log.type === LogType.CLOCK_OUT && <Square size={16} />}
                                {(log.type === LogType.START_BREAK || log.type === LogType.END_BREAK) && <Coffee size={16} />}
                            </div>
                            <span className="font-medium text-gray-800">
                                {log.type === LogType.CLOCK_IN ? t.btnStart : log.type === LogType.CLOCK_OUT ? t.btnStop : log.type === LogType.START_BREAK ? t.btnPause : t.btnResume}
                            </span>
                            </div>
                            <span className="font-mono text-gray-500">{new Date(log.timestamp).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {log.location && <div className="flex items-center gap-1 text-xs text-gray-400 pl-12"><MapPin size={12} /> {log.location}</div>}
                    </div>
                    ))
                }
                </div>
            </div>
            </div>
        </div>
      );
  }

  // --- ADMIN VIEW ---
  return (
    <div className="h-full flex flex-col relative">
        {showTutorial && <OnboardingTutorial user={user} language={language} onComplete={handleTutorialComplete} />}
        {isExpired && <div className="absolute inset-0 bg-white/80 z-30 backdrop-blur-sm" />}
        {renderTrialBanner()}
        <SubscriptionModal 
            isOpen={showSubscriptionModal} 
            onClose={() => { if (subscriptionMode !== 'TRIAL_SETUP' && orgDetails?.subscriptionStatus !== 'EXPIRED') setShowSubscriptionModal(false); }} 
            orgId={user.orgId}
            onSuccess={() => { setShowSubscriptionModal(false); refreshData(); }}
            mode={subscriptionMode}
            language={language}
        />
        
        {selectedEmployee && (
            <EmployeeDetailModal 
                isOpen={!!selectedEmployee}
                user={selectedEmployee}
                logs={selectedEmpLogs}
                leaves={selectedEmpLeaves}
                adjustments={selectedEmpAdjustments}
                defaultMonth={exportMonth}
                defaultYear={exportYear}
                onUpdateContract={(type, endDate) => selectedEmployee ? handleUpdateContract(selectedEmployee.id, type, endDate) : Promise.resolve()}
                onClose={() => setSelectedEmployee(null)}
                language={language}
            />
        )}

        <div className="max-w-4xl mx-auto w-full pt-safe px-4 h-full overflow-y-auto no-scrollbar pb-24">
            <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-3xl p-6 text-white mb-8 shadow-lg mt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-brand-100 mb-1"><Building size={16} /><span className="text-sm font-medium uppercase">{orgName}</span></div>
                        <h1 className="text-2xl font-bold">{t.adminDash}</h1>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex flex-col">
                            <span className="text-[10px] text-brand-200 uppercase font-bold mb-1">{t.inviteCode}</span>
                            <div className="flex items-center gap-3">
                                <code className="text-xl font-mono font-bold tracking-widest">{orgCode}</code>
                                <button onClick={() => navigator.clipboard.writeText(orgCode)} className="p-1.5 hover:bg-white/20 rounded-lg"><Copy size={16} /></button>
                                <button onClick={handleRegenerateCode} disabled={regeneratingCode} className="p-1.5 hover:bg-white/20 rounded-lg text-brand-200 hover:text-white" title={t.regenCode}>
                                    <RefreshCw size={16} className={regeneratingCode ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <select value={exportMonth} onChange={(e) => setExportMonth(parseInt(e.target.value))} className="bg-white/20 text-white border-none rounded-xl text-sm p-2 outline-none cursor-pointer hover:bg-white/30">
                                {t.months.map((m, i) => (
                                    <option key={i} value={i} className="text-black">{m}</option>
                                ))}
                             </select>
                             <select value={exportYear} onChange={(e) => setExportYear(parseInt(e.target.value))} className="bg-white/20 text-white border-none rounded-xl text-sm p-2 outline-none cursor-pointer hover:bg-white/30">
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y} className="text-black">{y}</option>
                                ))}
                             </select>
                        </div>
                        <button onClick={handleExportDoc} disabled={isExpired} className="bg-white text-brand-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-brand-50 disabled:opacity-50">
                            {orgDetails?.isPro ? <Download size={16} /> : <Crown size={16} />} 
                            {orgDetails?.isPro ? t.exportBtn : t.premiumBtn}
                        </button>
                    </div>
                </div>
            </div>

            {pendingUsers.length > 0 && (
                <div className="mb-8 animate-pulse">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-yellow-800 mb-3 flex items-center gap-2"><ShieldAlert size={20} /> {t.pendingReq} ({pendingUsers.length})</h2>
                        <div className="space-y-3">
                            {pendingUsers.map(u => (
                                <div key={u.id} className="bg-white p-3 rounded-xl border border-yellow-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="font-bold text-gray-800">{u.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{u.taxId}</div>
                                        <div className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full inline-block mt-1">{t.emailVerified}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRejectUser(u.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><X size={20} /></button>
                                        <button onClick={() => handleApproveUser(u.id)} className="p-2 bg-green-50 text-green-600 rounded-lg"><Check size={20} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {pendingContracts.length > 0 && (
                <div className="mb-8">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2"><ShieldAlert size={20} /> {t.pendingContracts} ({pendingContracts.length})</h2>
                        <div className="space-y-3">
                            {pendingContracts.map(u => (
                                <div key={u.id} className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="font-bold text-gray-800">{u.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{u.taxId}</div>
                                        <div className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full inline-block mt-1">{t.contractMissing}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenEmployeeDetail(u.id)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">{t.assignContract}</button>
                                        <button onClick={(e) => handleDeleteEmployee(e, u.id)} className="p-2 bg-red-50 text-red-600 rounded-lg" title={t.deleteEmp}><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Users className="text-brand-600" /> {t.empStatus}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orgEmployees.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                        <UserPlus className="mx-auto text-gray-300 mb-3" size={48} />
                        <p className="text-gray-400">{t.noEmp}</p>
                    </div>
                ) : (
                    orgEmployees.map(emp => {
                        return (
                        <div 
                            key={emp.userId} 
                            onClick={() => handleOpenEmployeeDetail(emp.userId)}
                            className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:shadow-md transition-all group`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-600 transition-colors flex items-center gap-2">
                                        {emp.userName}
                                        <Eye size={16} className="text-gray-300 group-hover:text-brand-400" />
                                    </h3>
                                    
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2.5 h-2.5 rounded-full ${emp.currentStatus === WorkStatus.WORKING ? 'bg-green-500 animate-pulse' : emp.currentStatus === WorkStatus.ON_BREAK ? 'bg-orange-500' : 'bg-gray-300'}`}></span>
                                        <span className={`text-sm font-medium ${emp.currentStatus === WorkStatus.WORKING ? 'text-green-600' : emp.currentStatus === WorkStatus.ON_BREAK ? 'text-orange-600' : 'text-gray-500'}`}>
                                            {emp.currentStatus === WorkStatus.WORKING ? t.statusWorking : emp.currentStatus === WorkStatus.ON_BREAK ? t.statusBreak : t.statusIdle}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {emp.currentStatus !== WorkStatus.IDLE && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{new Date(emp.lastActive).toLocaleTimeString(getLocale(), {hour:'2-digit', minute:'2-digit'})}</span>}
                                    <button onClick={(e) => handleDeleteEmployee(e, emp.userId)} className="text-red-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors mt-2" title={t.deleteEmp}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                <div className="bg-brand-50 p-3 rounded-xl"><div className="text-2xl font-bold text-brand-900">{emp.totalHours.toFixed(1)}</div><div className="text-[10px] uppercase font-bold text-brand-400">{t.totalHours}</div></div>
                                <div className="bg-purple-50 p-3 rounded-xl"><div className="text-2xl font-bold text-purple-900">{emp.daysWorked}</div><div className="text-[10px] uppercase font-bold text-purple-400">{t.daysPresent}</div></div>
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>
    </div>
  );
};
