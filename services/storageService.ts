'use client';

import { TimeLog, LeaveRequest, User, Organization, UserStatus, Language, NotificationItem, TimeAdjustment } from '../types';

const fetchJson = async <T = any>(url: string, options?: RequestInit): Promise<T> => {
  const merged = { credentials: 'include' as RequestCredentials, ...options } as RequestInit;
  const res = await fetch(url, merged);
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

  // Notifications
  getNotifications: async (): Promise<NotificationItem[]> => {
    const { data } = await fetchJson<{ data: any[] }>('/api/notifications');
    return data.map(n => ({
      id: n.id,
      userId: n.userId,
      orgId: n.orgId,
      type: n.type,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      createdAt: n.createdAt
    }));
  },

  markNotificationsRead: async (id?: string): Promise<void> => {
    await fetchJson('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  },

  // Adjustments
  getAdjustments: async (userId?: string): Promise<TimeAdjustment[]> => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    const { data } = await fetchJson<{ data: any[] }>(`/api/adjustments?${params.toString()}`);
    const normalizeTime = (val?: string | null) => {
      if (!val) return undefined;
      if (val.includes(':')) return val.slice(0,5);
      return val;
    };
    return (data || []).map(d => ({
      id: d.id,
      orgId: d.org_id,
      userId: d.user_id,
      date: d.date,
      clockIn: normalizeTime(d.clock_in_new || d.clock_in),
      clockOut: normalizeTime(d.clock_out_new || d.clock_out),
      clockInOld: normalizeTime(d.clock_in_old),
      clockOutOld: normalizeTime(d.clock_out_old),
      clockInNew: normalizeTime(d.clock_in_new),
      clockOutNew: normalizeTime(d.clock_out_new),
      pauseStart: normalizeTime(d.pause_start_old),
      pauseEnd: normalizeTime(d.pause_end_old),
      pauseStartNew: normalizeTime(d.pause_start),
      pauseEndNew: normalizeTime(d.pause_end),
      reason: d.reason,
      status: d.status,
      approverId: d.approver_id,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      reviewedAt: d.reviewed_at ? new Date(d.reviewed_at).getTime() : undefined,
    }));
  },

  createAdjustment: async (payload: { date: string; clockInOld?: string; clockOutOld?: string; clockInNew: string; clockOutNew: string; reason: string }): Promise<void> => {
    await fetchJson('/api/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  updateAdjustmentStatus: async (id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> => {
    await fetchJson('/api/adjustments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
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
      contractType: u.contract_type,
      contractEndDate: u.contract_end_date,
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

  updateContractInfo: async (targetUserId: string, contractType: 'DETERMINATO' | 'INDETERMINATO', contractEndDate?: string): Promise<void> => {
    await fetchJson('/api/org/contract', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, contractType, contractEndDate })
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

  getWorkSummary: async (userId: string | undefined, orgId: string | undefined, month: number | undefined, year: number | undefined, language: Language = 'IT') => {
    // build summary client-side using existing logs API
    const logs = await StorageService.getLogs(userId, orgId);
    const adjustments = await StorageService.getAdjustments(userId);
    const approvedAdjustments = adjustments.filter(a => a.status === 'APPROVED');
    const parseTime = (dateStr: string, timeStr?: string) => {
      if (!timeStr) return null;
      const normalized = timeStr.includes(':') ? timeStr.slice(0, 5) : timeStr;
      const d = new Date(`${dateStr}T${normalized}`);
      const ts = d.getTime();
      return isNaN(ts) ? null : ts;
    };

    // apply approved adjustments: replace logs for that user/day with corrected in/out
    let mergedLogs = [...logs];
    approvedAdjustments.forEach(adj => {
      const startTs = parseTime(adj.date, adj.clockInNew || adj.clockIn);
      const endTs = parseTime(adj.date, adj.clockOutNew || adj.clockOut);
      const pauseStartTs = parseTime(adj.date, adj.pauseStartNew || adj.pauseStart);
      const pauseEndTs = parseTime(adj.date, adj.pauseEndNew || adj.pauseEnd);
      if (startTs !== null && endTs !== null && endTs > startTs) {
        mergedLogs = mergedLogs.filter(l => !(l.userId === adj.userId && l.dateString === adj.date));
        mergedLogs.push({
          id: `adj-${adj.id}-in`,
          userId: adj.userId,
          orgId: adj.orgId,
          timestamp: startTs,
          type: 'CLOCK_IN',
          dateString: adj.date
        } as any);
        if (pauseStartTs !== null && pauseEndTs !== null && pauseEndTs > pauseStartTs && pauseStartTs > startTs && pauseEndTs < endTs) {
          mergedLogs.push({
            id: `adj-${adj.id}-pstart`,
            userId: adj.userId,
            orgId: adj.orgId,
            timestamp: pauseStartTs,
            type: 'START_BREAK',
            dateString: adj.date
          } as any);
          mergedLogs.push({
            id: `adj-${adj.id}-pend`,
            userId: adj.userId,
            orgId: adj.orgId,
            timestamp: pauseEndTs,
            type: 'END_BREAK',
            dateString: adj.date
          } as any);
        }
        mergedLogs.push({
          id: `adj-${adj.id}-out`,
          userId: adj.userId,
          orgId: adj.orgId,
          timestamp: endTs,
          type: 'CLOCK_OUT',
          dateString: adj.date
        } as any);
      }
    });

    const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // filter by month/year using dateString to avoid TZ drift between months
    let filteredLogs = mergedLogs;
    if (month !== undefined && year !== undefined) {
      filteredLogs = mergedLogs.filter(l => {
        const d = new Date(l.dateString);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    // group by user/day
    type Segment = { start: number; end: number };
    type DaySummary = { dateKey: string; dateLabel: string; segments: Segment[]; totalMs: number; description: string };
    type UserSummary = { userId: string; days: DaySummary[]; totalMs: number };
    const byUser = new Map<string, Map<string, { totalMs: number; segments: Segment[] }>>();

    filteredLogs.sort((a, b) => a.timestamp - b.timestamp).forEach(log => {
      const dk = new Date(log.timestamp).toISOString().split('T')[0];
      if (!byUser.has(log.userId)) byUser.set(log.userId, new Map());
      if (!byUser.get(log.userId)!.has(dk)) byUser.get(log.userId)!.set(dk, { totalMs: 0, segments: [] });
    });

    for (const [uid, dayMap] of byUser.entries()) {
      const userLogs = filteredLogs.filter(l => l.userId === uid).sort((a, b) => a.timestamp - b.timestamp);
      let open: number | null = null;
      let openDate = '';
      const close = (endTs: number) => {
        if (open !== null && openDate) {
          const entry = dayMap.get(openDate);
          if (entry) {
            entry.totalMs += endTs - open;
            entry.segments.push({ start: open, end: endTs });
          }
          open = null;
          openDate = '';
        }
      };
      userLogs.forEach(l => {
        const dk = new Date(l.timestamp).toISOString().split('T')[0];
        if (l.type === 'CLOCK_IN' || l.type === 'END_BREAK') { open = l.timestamp; openDate = dk; }
        if ((l.type === 'START_BREAK' || l.type === 'CLOCK_OUT') && open !== null) { close(l.timestamp); }
      });
      if (open !== null && openDate) {
        const endOfDay = new Date(`${openDate}T23:59:59`).getTime();
        close(endOfDay);
      }
    }

    const summaries: UserSummary[] = [];
    for (const [uid, dayMap] of byUser.entries()) {
      const days: DaySummary[] = Array.from(dayMap.keys()).sort().map(dk => {
        const entry = dayMap.get(dk)!;
        // Always compute min/max per day to ensure duration > 0 when logs exist
        const logsDay = filteredLogs.filter(l => l.userId === uid && new Date(l.timestamp).toISOString().split('T')[0] === dk);
        const ins = logsDay.filter(l => l.type === 'CLOCK_IN' || l.type === 'END_BREAK').map(l => l.timestamp);
        const outs = logsDay.filter(l => l.type === 'CLOCK_OUT' || l.type === 'START_BREAK').map(l => l.timestamp);
        if (ins.length && outs.length) {
          const minIn = Math.min(...ins);
          const maxOut = Math.max(...outs);
          if (maxOut > minIn) {
            entry.totalMs = maxOut - minIn;
            entry.segments = [{ start: minIn, end: maxOut }];
          }
        }
        const desc = entry.segments.length === 0
          ? ''
          : entry.segments.length === 1
            ? `inizio: ${formatTime(entry.segments[0].start)} , fine: ${formatTime(entry.segments[0].end)}`
            : entry.segments.length === 2
              ? `inizio: ${formatTime(entry.segments[0].start)} , pausa: ${formatTime(entry.segments[0].end)} , inizio secondo turno: ${formatTime(entry.segments[1].start)} , fine: ${formatTime(entry.segments[1].end)}`
              : entry.segments.map((s, idx) => `turno ${idx + 1}: ${formatTime(s.start)} - ${formatTime(s.end)}`).join(' , ');
        return {
          dateKey: dk,
          dateLabel: formatDate(dk),
          segments: entry.segments,
          totalMs: entry.totalMs,
          description: desc
        };
      });
      const totalMs = days.reduce((acc, d) => acc + d.totalMs, 0);
      summaries.push({ userId: uid, days, totalMs });
    }
    return summaries;
  },

  exportDataAsDoc: async (userId: string | undefined, orgId: string | undefined, month: number | undefined, year: number | undefined, language: Language = 'IT', users?: User[]): Promise<string> => {
    const summaries = await StorageService.getWorkSummary(userId, orgId, month, year, language);
    const monthName = month !== undefined ? new Date(year || new Date().getFullYear(), month).toLocaleString(language === 'EN' ? 'en-US' : language.toLowerCase(), { month: 'long' }) : '';
    const yearLabel = year ?? new Date().getFullYear();
    const formatHours = (ms: number) => (ms / (1000 * 60 * 60)).toFixed(2);
    const findName = (uid: string) => users?.find(u => u.id === uid)?.name || uid;
    const sortedSummaries = [...summaries].sort((a, b) => findName(a.userId).localeCompare(findName(b.userId)));

    let body = `
      <div class="title">Report Presenze ${monthName ? monthName + ' ' : ''}${yearLabel}</div>
      <div class="meta">Generato il ${new Date().toLocaleDateString(language === 'EN' ? 'en-US' : language.toLowerCase())}</div>
      <div class="legend">
        <div class="pill pill-dark">Totale mese</div>
        <div class="pill pill-light">Dettaglio giornaliero</div>
      </div>
    `;
    sortedSummaries.forEach((summary) => {
      const totalHours = formatHours(summary.totalMs);
      body += `
        <section class="user">
          <div class="user-header">
            <div>
              <div class="eyebrow">Dipendente</div>
              <div class="user-name">${findName(summary.userId)}</div>
            </div>
            <div class="pill">Totale mese: <strong>${totalHours} h</strong></div>
          </div>
          <table class="day-table">
            <thead><tr><th>Data</th><th>Dettagli</th><th>Ore</th></tr></thead>
            <tbody>
      `;
      if (summary.days.length === 0) {
        body += `<tr><td colspan="3" class="empty">Nessuna attivita</td></tr>`;
      } else {
        summary.days.forEach((d, idxRow) => {
          const rowClass = idxRow % 2 === 0 ? 'even' : 'odd';
          const detail = d.description || 'Nessuna attivita';
          body += `<tr class="${rowClass}"><td class="date">${d.dateLabel}</td><td class="desc">${detail}</td><td class="hours">${formatHours(d.totalMs)}</td></tr>`;
        });
        body += `<tr class="total-row"><td colspan="2">Totale mese</td><td class="hours">${totalHours}</td></tr>`;
      }
      body += `</tbody></table></section>`;
    });

    const styles = `
      * { font-family: 'Segoe UI', Arial, sans-serif; }
      body { padding: 24px; background: #f5f7fb; color: #0f172a; }
      .title { font-size: 24px; font-weight: 800; margin-bottom: 4px; color: #0f172a; }
      .meta { font-size: 12px; color: #64748b; margin-bottom: 12px; }
      .legend { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
      .pill { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; font-size:12px; font-weight:700; }
      .pill-dark { background:#0f172a; color:#e2e8f0; }
      .pill-light { background:#e2e8f0; color:#0f172a; }
      .user { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06); }
      .user-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f8fafc, #edf2f7); border-bottom: 1px solid #e2e8f0; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; font-weight: 700; color: #94a3b8; }
      .user-name { font-size: 18px; font-weight: 800; color: #0f172a; }
      .pill { background: #0f172a; color: #e2e8f0; padding: 8px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
      .day-table { width: 100%; border-collapse: collapse; }
      .day-table th { text-align: left; background: #1f2937; color: #fff; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
      .day-table td { padding: 10px; border-top: 1px solid #e5e7eb; vertical-align: top; font-size: 13px; }
      .day-table .date { font-weight: 700; width: 120px; color: #0f172a; }
      .day-table .desc { color: #334155; line-height: 1.5; }
      .day-table .hours { font-weight: 800; text-align: right; white-space: nowrap; color: #0f172a; }
      .day-table tr.odd td { background: #f8fafc; }
      .day-table tr.even td { background: #ffffff; }
      .day-table .total-row td { background: #0f172a; color:#e2e8f0; font-weight: 800; }
      .empty { text-align: center; color: #94a3b8; font-style: italic; padding: 14px; }
    `;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8" /><style>${styles}</style></head>
        <body>${body}</body>
      </html>
    `;
    return html;
  },



  // Account
  deleteAccount: async (): Promise<void> => {
    await fetchJson('/api/account', { method: 'DELETE' });
  }
};
