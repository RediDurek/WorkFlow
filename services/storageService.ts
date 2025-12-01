'use client';

import { TimeLog, LeaveRequest, User, Organization, UserStatus, Language } from '../types';

const fetchJson = async <T = any>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }
  // @ts-expect-error allow text
  return res.text();
};

export const StorageService = {
  // Logs
  getLogs: async (userId?: string, orgId?: string): Promise<TimeLog[]> => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (orgId) params.set('orgId', orgId);
    const { data } = await fetchJson<{ data: any[] }>(`/api/logs?${params.toString()}`);
    return data.map(l => ({
      id: l.id,
      userId: l.user_id,
      orgId: l.org_id,
      timestamp: new Date(l.timestamp).getTime(),
      type: l.type,
      dateString: new Date(l.timestamp).toISOString().split('T')[0],
      location: l.location || undefined
    }));
  },

  addLog: async (log: TimeLog): Promise<void> => {
    await fetchJson('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log })
    });
  },

  // Leave
  getLeaveRequests: async (userId?: string, orgId?: string): Promise<LeaveRequest[]> => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (orgId) params.set('orgId', orgId);
    const { data } = await fetchJson<{ data: any[] }>(`/api/leaves?${params.toString()}`);
    return data.map(l => ({
      id: l.id,
      userId: l.user_id,
      orgId: l.org_id,
      userName: l.users?.name || 'Sconosciuto',
      startDate: l.start_date,
      endDate: l.end_date,
      type: l.type,
      reason: l.reason,
      status: l.status,
      attachment: l.attachment
    }));
  },

  addLeaveRequest: async (req: LeaveRequest): Promise<void> => {
    await fetchJson('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: req })
    });
  },

  updateLeaveStatus: async (reqId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> => {
    await fetchJson('/api/leaves', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reqId, status })
    });
  },

  // Organization
  getOrganization: async (orgId: string): Promise<Organization | undefined> => {
    const { data } = await fetchJson<{ data: any }>(`/api/org/organization?orgId=${orgId}`);
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      createdAt: new Date(data.created_at).getTime(),
      subscriptionStatus: data.subscription_status,
      trialEndsAt: new Date(data.trial_ends_at).getTime(),
      isPro: data.is_pro,
      paymentMethodLinked: data.payment_method_linked,
      autoRenew: data.auto_renew,
      taxId: data.tax_id
    };
  },

  regenerateOrgCode: async (): Promise<string> => {
    const { code } = await fetchJson<{ code: string }>('/api/org/code', { method: 'POST' });
    return code;
  },

  linkPaymentMethod: async (): Promise<boolean> => {
    try {
      await fetchJson('/api/org/payment', { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  },

  cancelAutoRenew: async (): Promise<boolean> => {
    try {
      await fetchJson('/api/org/payment', { method: 'PUT' });
      return true;
    } catch {
      return false;
    }
  },

  // Employees / Admin
  getOrgEmployees: async (orgId: string): Promise<User[]> => {
    const { data } = await fetchJson<{ data: any[] }>('/api/org/employees');
    return data.map(u => ({
      id: u.id,
      orgId: u.org_id,
      name: u.name,
      email: u.email,
      taxId: u.tax_id,
      role: u.role,
      status: u.status,
      isEmailVerified: u.is_email_verified,
      verificationCode: u.verification_code,
      resetCode: u.reset_code,
      privacyAccepted: u.privacy_accepted,
      hasSeenTutorial: u.has_seen_tutorial,
      createdAt: new Date(u.created_at).getTime()
    }));
  },

  updateUserStatus: async (_adminId: string, targetUserId: string, newStatus: UserStatus): Promise<void> => {
    await fetchJson('/api/org/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, status: newStatus })
    });
  },

  removeUserFromOrg: async (targetUserId: string): Promise<void> => {
    const params = new URLSearchParams({ userId: targetUserId });
    await fetchJson(`/api/org/employees?${params.toString()}`, { method: 'DELETE' });
  },

  // Tutorial
  completeTutorial: async (): Promise<void> => {
    await fetchJson('/api/tutorial', { method: 'POST' });
  },

  // Export
  exportDataAsCSV: async (userId: string | undefined, orgId: string | undefined, month: number | undefined, year: number | undefined, language: Language = 'IT'): Promise<string> => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (orgId) params.set('orgId', orgId);
    if (month !== undefined) params.set('month', String(month));
    if (year !== undefined) params.set('year', String(year));
    params.set('lang', language);
    const res = await fetch(`/api/export/csv?${params.toString()}`);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch {}
      throw new Error(msg);
    }
    return await res.text();
  },

  // Account
  deleteAccount: async (): Promise<void> => {
    await fetchJson('/api/account', { method: 'DELETE' });
  }
};
