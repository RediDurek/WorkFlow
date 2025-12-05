'use client';

import React, { useEffect, useState } from 'react';
import { Language, User } from '../types';
import { translations } from '../constants/translations';
import { StorageService } from '../services/storageService';
import { Loader2, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface RolesProps {
  user: User;
  language: Language;
}

interface Role {
  id: string;
  name: string;
  position: number;
}

export const Roles: React.FC<RolesProps> = ({ user, language }) => {
  const t = translations[language];
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRole, setNewRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await StorageService.getOrgRoles();
      setRoles(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    setSaving(true);
    try {
      await StorageService.createRole(newRole.trim());
      setNewRole('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id: string, current: string) => {
    const name = prompt(t.renameRole, current) || '';
    if (!name.trim()) return;
    setSaving(true);
    try {
      await StorageService.updateRole(id, { name: name.trim() });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDeleteRole)) return;
    setSaving(true);
    try {
      await StorageService.deleteRole(id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...roles].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(r => r.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const target = sorted[swapIdx];
    setSaving(true);
    try {
      await Promise.all([
        StorageService.updateRole(current.id, { position: target.position }),
        StorageService.updateRole(target.id, { position: current.position })
      ]);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (user.role !== 'ADMIN') {
    return <div className="p-4 text-center text-sm text-gray-400">Accesso negato</div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full pt-safe px-4 pb-24">
      <header className="flex items-center justify-between mb-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.rolesTitle}</h1>
          <p className="text-gray-500 text-sm">{t.rolesHint}</p>
        </div>
        {saving && <Loader2 size={18} className="animate-spin text-gray-400" />}
      </header>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input value={newRole} onChange={e => setNewRole(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm" placeholder={t.roleName} />
        <button type="submit" disabled={saving} className="px-3 py-2 bg-brand-600 text-white rounded-lg font-bold flex items-center gap-1 hover:bg-brand-700 disabled:opacity-60">
          <Plus size={16} /> {t.createRole}
        </button>
      </form>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-6">Loading...</div>
        ) : roles.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">{t.noAnnouncements}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {[...roles].sort((a, b) => a.position - b.position).map(r => (
              <div key={r.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold text-gray-800">{r.name}</div>
                  <div className="text-xs text-gray-400">{t.rolePosition}: {r.position}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => move(r.id, 'up')} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title={t.moveUp}><ArrowUp size={16} /></button>
                  <button onClick={() => move(r.id, 'down')} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title={t.moveDown}><ArrowDown size={16} /></button>
                  <button onClick={() => handleRename(r.id, r.name)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title={t.renameRole}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg border border-red-100 text-red-500 hover:bg-red-50" title={t.deleteRole}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
