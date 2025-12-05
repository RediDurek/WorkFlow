'use client';

import React, { useEffect, useState } from 'react';
import { Language, User } from '../types';
import { translations } from '../constants/translations';
import { StorageService } from '../services/storageService';
import { Send, Bell, Users, Loader2 } from 'lucide-react';

interface AnnouncementsProps {
  user: User;
  language: Language;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  authorId?: string;
  audienceRoleIds?: string[];
}

export const Announcements: React.FC<AnnouncementsProps> = ({ user, language }) => {
  const t = translations[language];
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; position: number }[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ann, r] = await Promise.all([
        StorageService.getAnnouncements(),
        StorageService.getOrgRoles().catch(() => [])
      ]);
      setAnnouncements(ann);
      setRoles(r);
      await StorageService.markAnnouncementRead().catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setIsSending(true);
    try {
      await StorageService.createAnnouncement({ title: title.trim(), body: message.trim(), audienceRoleIds: audience });
      setTitle('');
      setMessage('');
      setAudience([]);
      await loadAll();
    } finally {
      setIsSending(false);
    }
  };

  const toggleRole = (id: string) => {
    setAudience(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const audienceLabel = (a?: string[]) => {
    if (!a || a.length === 0) return t.recipientsAll;
    const names = a.map(rid => roles.find(r => r.id === rid)?.name || rid);
    return `${t.recipientsRoles}: ${names.join(', ')}`;
  };

  return (
    <div className="max-w-3xl mx-auto w-full pt-safe px-4 pb-24">
      <header className="flex items-center justify-between mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Bell size={22} className="text-brand-600" /> {t.announcementsTitle}</h1>
          <p className="text-gray-500 text-sm">{t.announcementsSubtitle}</p>
        </div>
      </header>

      {user.role === 'ADMIN' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={18} className="text-brand-600" /> {t.newAnnouncement}</h3>
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.titleLabel}</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" placeholder={t.titleLabel} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.messageLabel}</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 h-24 resize-none" placeholder={t.messageLabel} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.audienceLabel}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAudience([])}
                  className={`px-3 py-1 rounded-full text-xs border ${audience.length === 0 ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  {t.audienceAll}
                </button>
                {roles.sort((a, b) => a.position - b.position).map(role => (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => toggleRole(role.id)}
                    className={`px-3 py-1 rounded-full text-xs border ${audience.includes(role.id) ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t.rolesHint}</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={isSending} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-60 flex items-center gap-2">
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t.sendAnnouncement}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-brand-600" /> {t.announcementsTitle}</h3>
          <button onClick={() => StorageService.markAnnouncementRead().then(() => loadAll())} className="text-xs text-brand-600 hover:text-brand-700">{t.markAllRead}</button>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-6">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">{t.noAnnouncements}</div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{a.title}</div>
                    <div className="text-[11px] text-gray-500">{t.sentOn}: {new Date(a.createdAt).toLocaleString()} {user.role === 'ADMIN' && a.authorId ? `(${t.by} ${a.authorId})` : ''}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">{audienceLabel(a.audienceRoleIds)}</div>
                </div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
