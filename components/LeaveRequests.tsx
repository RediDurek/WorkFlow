
import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Calendar, Plus, X, Check, XCircle, Paperclip, Eye, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { polishLeaveReason } from '../services/geminiService';
import { LeaveRequest, LeaveType, User, Language } from '../types';
import { SubscriptionModal } from './SubscriptionModal';
import { translations } from '../constants/translations';

interface LeaveRequestsProps {
  user: User;
  language: Language;
}

export const LeaveRequests: React.FC<LeaveRequestsProps> = ({ user, language }) => {
  const t = translations[language];
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<LeaveType>(LeaveType.VACATION);
  const [reason, setReason] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [attachment, setAttachment] = useState<string | undefined>(undefined);
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [viewAttachment, setViewAttachment] = useState<string | null>(null);

  useEffect(() => {
    const loadRequests = async () => {
      const reqs = await StorageService.getLeaveRequests(user.role === 'EMPLOYEE' ? user.id : undefined, user.orgId);
      setRequests(reqs.reverse());
    };
    loadRequests();
  }, [user]);

  const handlePolish = async () => {
    const org = await StorageService.getOrganization(user.orgId);
    if (!org?.isPro || org?.subscriptionStatus === 'EXPIRED') {
         setShowSubscriptionModal(true);
         return;
    }
    
    if (!reason.trim()) return;
    setIsPolishing(true);
    const polished = await polishLeaveReason(reason, language);
    setReason(polished);
    setIsPolishing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  // Resize to max 800px to save LocalStorage space
                  const MAX_WIDTH = 800;
                  const MAX_HEIGHT = 800;
                  let width = img.width;
                  let height = img.height;

                  if (width > height) {
                      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                  } else {
                      if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // Compress to JPEG 0.6 quality
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                  setAttachment(dataUrl);
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    const newReq: LeaveRequest = {
      id: crypto.randomUUID(), userId: user.id, orgId: user.orgId, userName: user.name,
      startDate, endDate, type, reason, status: 'PENDING', attachment
    };
    StorageService.addLeaveRequest(newReq);
    setRequests([newReq, ...requests]);
    setShowForm(false);
    setStartDate(''); setEndDate(''); setReason(''); setType(LeaveType.VACATION); setAttachment(undefined);
  };

  const handleAdminAction = (reqId: string, status: 'APPROVED' | 'REJECTED') => {
      StorageService.updateLeaveStatus(reqId, status);
      setRequests(requests.map(r => r.id === reqId ? { ...r, status } : r));
  };

  const formatDate = (dateStr: string) => {
      const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
      return new Date(dateStr).toLocaleDateString(locale);
  };

  return (
    <div className="max-w-md mx-auto md:max-w-4xl w-full pt-safe px-4 h-full overflow-y-auto no-scrollbar pb-24">
      <SubscriptionModal 
            isOpen={showSubscriptionModal} 
            onClose={() => setShowSubscriptionModal(false)} 
            orgId={user.orgId}
            onSuccess={() => setShowSubscriptionModal(false)}
            mode="UPGRADE"
            language={language}
      />
      
      {viewAttachment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewAttachment(null)}>
              <div className="relative max-w-full max-h-full">
                  <button className="absolute -top-12 right-0 text-white p-2" onClick={() => setViewAttachment(null)}><X size={24} /></button>
                  <img src={viewAttachment} alt="Attachment" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
              </div>
          </div>
      )}

      <header className="flex justify-between items-center mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.leavesTitle}</h1>
          <p className="text-gray-500 text-sm">{user.role === 'ADMIN' ? t.leavesAdminSub : t.leavesEmpSub}</p>
        </div>
        {user.role === 'EMPLOYEE' && (
            <button onClick={() => setShowForm(true)} className="bg-brand-600 text-white p-3 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-transform"><Plus size={24} /></button>
        )}
      </header>

      {showForm && user.role === 'EMPLOYEE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 text-gray-800">{t.newReq}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">{t.from}</label><input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">{t.to}</label><input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">{t.type}</label><select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">{Object.values(LeaveType).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex justify-between"><span>{t.reason}</span><span className="text-brand-600 flex items-center gap-1 text-[10px] bg-brand-50 px-2 py-0.5 rounded-full"><Sparkles size={10} /> {t.aiPowered}</span></label>
                <div className="relative">
                  <textarea required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm h-24 resize-none" />
                  <button type="button" onClick={handlePolish} disabled={!reason || isPolishing} className="absolute bottom-2 right-2 bg-white border border-gray-200 text-brand-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50">{isPolishing ? '...' : <><Sparkles size={12} /> {t.btnRewrite}</>}</button>
                </div>
              </div>
              
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.uploadDoc}</label>
                  <label className="flex items-center gap-3 w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3 cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="bg-white p-2 rounded-lg border border-gray-200 text-gray-500"><Paperclip size={20} /></div>
                      <span className="text-sm text-gray-500 truncate">{attachment ? 'Immagine caricata!' : t.uploadDoc}</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                  {attachment && (
                      <div className="mt-2 relative inline-block">
                          <img src={attachment} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                          <button type="button" onClick={() => setAttachment(undefined)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10} /></button>
                      </div>
                  )}
              </div>

              <button type="submit" className="w-full bg-brand-600 text-white font-semibold py-3.5 rounded-xl shadow-lg hover:bg-brand-700 active:scale-95 transition-all mt-4 flex justify-center items-center gap-2"><Send size={18} /> {t.btnSend}</button>
            </form>
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${user.role === 'ADMIN' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {requests.length === 0 ? (
          <div className="col-span-full text-center py-12 opacity-50"><Calendar size={48} className="mx-auto mb-3 text-gray-300" /><p>Nessuna richiesta.</p></div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                  {user.role === 'ADMIN' && <span className="text-sm font-bold text-gray-900 mb-1">{req.userName}</span>}
                  <div className="flex gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700">{req.type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center ${req.status === 'APPROVED' ? 'border-green-200 text-green-600 bg-green-50' : req.status === 'REJECTED' ? 'border-red-200 text-red-600 bg-red-50' : 'border-yellow-200 text-yellow-600 bg-yellow-50'}`}>
                        {req.status === 'PENDING' ? t.pending : req.status === 'APPROVED' ? t.approved : t.rejected}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-900 mb-2">{formatDate(req.startDate)} - {formatDate(req.endDate)}</div>
              <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 flex-grow">"{req.reason}"</p>
              
              {req.attachment && (
                  <button onClick={() => setViewAttachment(req.attachment!)} className="mb-4 flex items-center gap-2 text-sm text-brand-600 bg-brand-50 p-2 rounded-lg hover:bg-brand-100 transition-colors w-full justify-center">
                      <ImageIcon size={16} /> {t.viewDoc}
                  </button>
              )}
              
              {user.role === 'ADMIN' && req.status === 'PENDING' && (
                  <div className="mt-auto">
                      <div className="flex gap-2 border-t border-gray-100 pt-3">
                          <button onClick={() => handleAdminAction(req.id, 'APPROVED')} className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Check size={16} /> {t.approve}</button>
                          <button onClick={() => handleAdminAction(req.id, 'REJECTED')} className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><XCircle size={16} /> {t.reject}</button>
                      </div>
                  </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
