'use client';

import { createClient } from '@supabase/supabase-js';
import { TimeLog, LeaveRequest, User, Organization, LogType, UserStatus, SubscriptionStatus, Language, LeaveType } from '../types';

// Initialize Supabase client (browser-safe, uses anon key only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generateAuthCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashPassword = async (pass: string) => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // Browser: usa WebCrypto
    const msgBuffer = new TextEncoder().encode(pass);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js: usa crypto
    try {
      const crypto = await import('crypto');
      return crypto.createHash('sha256').update(pass).digest('hex');
    } catch (err) {
      throw new Error('WebCrypto non disponibile e crypto non importabile');
    }
  }
};

// Mapping functions to convert between database (snake_case) and app (camelCase)
const dbUserToUser = (dbUser: any): User => ({
  id: dbUser.id,
  orgId: dbUser.org_id,
  name: dbUser.name,
  email: dbUser.email,
  taxId: dbUser.tax_id,
  role: dbUser.role,
  status: dbUser.status,
  isEmailVerified: dbUser.is_email_verified,
  verificationCode: dbUser.verification_code,
  resetCode: dbUser.reset_code,
  privacyAccepted: dbUser.privacy_accepted,
  hasSeenTutorial: dbUser.has_seen_tutorial,
  createdAt: new Date(dbUser.created_at).getTime()
});

const dbOrgToOrg = (dbOrg: any): Organization => ({
  id: dbOrg.id,
  name: dbOrg.name,
  code: dbOrg.code,
  createdAt: new Date(dbOrg.created_at).getTime(),
  subscriptionStatus: dbOrg.subscription_status,
  trialEndsAt: new Date(dbOrg.trial_ends_at).getTime(),
  isPro: dbOrg.is_pro,
  paymentMethodLinked: dbOrg.payment_method_linked,
  autoRenew: dbOrg.auto_renew,
  taxId: dbOrg.tax_id
});

const dbTimeLogToTimeLog = (dbLog: any): TimeLog => ({
  id: dbLog.id,
  userId: dbLog.user_id,
  orgId: dbLog.org_id,
  timestamp: new Date(dbLog.timestamp).getTime(),
  type: dbLog.type,
  dateString: new Date(dbLog.timestamp).toLocaleDateString('it-IT'),
  location: dbLog.location
});

const dbLeaveToLeave = (dbLeave: any, userName: string): LeaveRequest => ({
  id: dbLeave.id,
  userId: dbLeave.user_id,
  orgId: dbLeave.org_id,
  userName,
  startDate: dbLeave.start_date,
  endDate: dbLeave.end_date,
  type: dbLeave.type,
  reason: dbLeave.reason,
  status: dbLeave.status,
  attachment: dbLeave.attachment
});

export const StorageService = {
  // --- AUTH & SESSION ---

  getSessionUser: async (): Promise<User | null> => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('workflow_session') : null;
      if (!raw) return null;

      const stored = JSON.parse(raw) as User;

      // Refresh user data from DB to keep status/flags in sync
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', stored.id)
        .single();

      if (error || !data) return stored;
      const user = dbUserToUser(data);
      localStorage.setItem('workflow_session', JSON.stringify(user));
      return user;
    } catch (err) {
      console.error('Error getting session user:', err);
      return null;
    }
  },

  login: async (email: string, pass: string): Promise<{ user: User | null; error?: string }> => {
    try {
      const passwordHash = await hashPassword(pass);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('password', passwordHash)
        .single();

      if (error || !data) {
        return { user: null, error: 'Email o password errati' };
      }

      const user = dbUserToUser(data);

      if (!user.isEmailVerified) {
        return { user: null, error: 'Email non verificata' };
      }
      if (user.role === 'EMPLOYEE' && user.status === 'PENDING_APPROVAL') {
        return { user: null, error: 'In attesa di approvazione.' };
      }
      if (user.status === 'BLOCKED') {
        return { user: null, error: 'Account bloccato.' };
      }

      // Store session
      localStorage.setItem('workflow_session', JSON.stringify(user));
      return { user };
    } catch (err) {
      console.error('Login error:', err);
      return { user: null, error: 'Errore nel login' };
    }
  },

  logout: async (): Promise<void> => {
    try {
      localStorage.removeItem('workflow_session');
    } catch (err) {
      console.error('Logout error:', err);
    }
  },

  // --- REGISTRATION ---

  registerOrg: async (orgName: string, adminName: string, email: string, pass: string, taxId: string): Promise<{ success: boolean; email?: string; error?: string; demoCode?: string }> => {
    try {
      // Check if email exists
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase());

      if (existingUsers && existingUsers.length > 0) {
        return { success: false, error: 'Email già registrata' };
      }

      // Create organization
      const trialDuration = 5 * 24 * 60 * 60 * 1000;
      const now = new Date().toISOString();
      const trialEndsAt = new Date(Date.now() + trialDuration).toISOString();

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          code: generateCode(),
          tax_id: taxId,
          subscription_status: 'TRIAL',
          trial_ends_at: trialEndsAt,
          is_pro: true,
          payment_method_linked: false,
          auto_renew: true
        })
        .select()
        .single();

      if (orgError || !org) {
        return { success: false, error: 'Errore nella creazione dell\'organizzazione' };
      }

      // Create admin user
      const passwordHash = await hashPassword(pass);
      const verificationCode = generateAuthCode();

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          org_id: org.id,
          name: adminName,
          email: email.toLowerCase(),
          tax_id: taxId,
          password: passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          is_email_verified: false,
          verification_code: verificationCode,
          privacy_accepted: true,
          has_seen_tutorial: false
        })
        .select()
        .single();

      if (userError || !user) {
        return { success: false, error: 'Errore nella creazione dell\'utente' };
      }

      return { success: true, email: user.email, demoCode: verificationCode };
    } catch (err) {
      console.error('Registration error:', err);
      return { success: false, error: 'Errore nella registrazione' };
    }
  },

  joinOrg: async (orgCode: string, name: string, email: string, pass: string, taxId: string): Promise<{ success: boolean; email?: string; error?: string; demoCode?: string }> => {
    try {
      // Check if email exists
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase());

      if (existingUsers && existingUsers.length > 0) {
        return { success: false, error: 'Email già registrata' };
      }

      // Find organization by code
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('code', orgCode)
        .single();

      if (orgError || !org) {
        return { success: false, error: 'Codice Azienda non valido' };
      }

      // Check tax ID uniqueness within organization
      if (taxId) {
        const { data: existingTaxIds } = await supabase
          .from('users')
          .select('id')
          .eq('tax_id', taxId)
          .eq('org_id', org.id);

        if (existingTaxIds && existingTaxIds.length > 0) {
          return { success: false, error: 'Codice Fiscale già presente in questa azienda.' };
        }
      }

      // Check Pro status
      const now = new Date();
      const isTrialActive = org.subscription_status === 'TRIAL' && new Date(org.trial_ends_at) > now;
      const isPro = org.subscription_status === 'ACTIVE' || isTrialActive;

      // Check employee limit
      if (!isPro) {
        const { data: employees, error: empError } = await supabase
          .from('users')
          .select('id')
          .eq('org_id', org.id)
          .eq('role', 'EMPLOYEE');

        if (!empError && employees && employees.length >= 3) {
          return { success: false, error: 'Limite dipendenti raggiunto.' };
        }
      }

      // Create user
      const passwordHash = await hashPassword(pass);
      const verificationCode = generateAuthCode();

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          org_id: org.id,
          name,
          email: email.toLowerCase(),
          tax_id: taxId,
          password: passwordHash,
          role: 'EMPLOYEE',
          status: 'PENDING_APPROVAL',
          is_email_verified: false,
          verification_code: verificationCode,
          privacy_accepted: true,
          has_seen_tutorial: false
        })
        .select()
        .single();

      if (userError || !user) {
        return { success: false, error: 'Errore nella creazione dell\'utente' };
      }

      return { success: true, email: user.email, demoCode: verificationCode };
    } catch (err) {
      console.error('Join org error:', err);
      return { success: false, error: 'Errore nel join dell\'organizzazione' };
    }
  },

  verifyEmail: async (email: string, code: string): Promise<{ user: User | null; error?: string }> => {
    try {
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (selectError || !user) {
        return { user: null, error: 'Utente non trovato' };
      }

      if (user.verification_code !== code) {
        return { user: null, error: 'Codice non valido' };
      }

      // Update verification status
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_email_verified: true, verification_code: null })
        .eq('id', user.id);

      if (updateError) {
        return { user: null, error: 'Errore nella verifica' };
      }

      if (user.role === 'ADMIN') {
        const updatedUser = dbUserToUser({ ...user, is_email_verified: true, verification_code: null });
        localStorage.setItem('workflow_session', JSON.stringify(updatedUser));
        return { user: updatedUser };
      } else {
        return { user: null, error: 'Email verificata! Attendi l\'approvazione.' };
      }
    } catch (err) {
      console.error('Email verification error:', err);
      return { user: null, error: 'Errore nella verifica' };
    }
  },

  resendCode: async (email: string): Promise<string | null> => {
    try {
      const newCode = generateAuthCode();

      const { error } = await supabase
        .from('users')
        .update({ verification_code: newCode })
        .eq('email', email.toLowerCase());

      if (error) return null;
      return newCode;
    } catch (err) {
      console.error('Resend code error:', err);
      return null;
    }
  },

  // --- PASSWORD RESET ---

  initiatePasswordReset: async (email: string): Promise<{ success: boolean; demoCode?: string; error?: string }> => {
    try {
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (selectError || !user) {
        return { success: false, error: 'Email non trovata.' };
      }

      const code = generateAuthCode();

      const { error: updateError } = await supabase
        .from('users')
        .update({ reset_code: code })
        .eq('id', user.id);

      if (updateError) {
        return { success: false, error: 'Errore nel reset' };
      }

      return { success: true, demoCode: code };
    } catch (err) {
      console.error('Initiate password reset error:', err);
      return { success: false, error: 'Errore nel reset' };
    }
  },

  completePasswordReset: async (email: string, code: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (selectError || !user) {
        return { success: false, error: 'Utente non trovato' };
      }

      if (user.reset_code !== code) {
        return { success: false, error: 'Codice non valido' };
      }

      const passwordHash = await hashPassword(newPass);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password: passwordHash, reset_code: null })
        .eq('id', user.id);

      if (updateError) {
        return { success: false, error: 'Errore nel reset' };
      }

      return { success: true };
    } catch (err) {
      console.error('Complete password reset error:', err);
      return { success: false, error: 'Errore nel reset' };
    }
  },

  // --- ORGANIZATION & SUBSCRIPTION ---

  getOrganization: async (orgId: string): Promise<Organization | undefined> => {
    try {
      let { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error || !org) return undefined;

      const now = new Date();
      if (org.subscription_status === 'TRIAL' && new Date(org.trial_ends_at) < now) {
        const { error: updateError } = await supabase
          .from('organizations')
          .update({ subscription_status: 'EXPIRED', is_pro: false })
          .eq('id', orgId);

        if (!updateError) {
          org.subscription_status = 'EXPIRED';
          org.is_pro = false;
        }
      } else if (org.subscription_status === 'TRIAL') {
        org.is_pro = true;
      }

      return dbOrgToOrg(org);
    } catch (err) {
      console.error('Get organization error:', err);
      return undefined;
    }
  },

  regenerateOrgCode: async (orgId: string): Promise<string> => {
    try {
      const newCode = generateCode();

      const { error } = await supabase
        .from('organizations')
        .update({ code: newCode })
        .eq('id', orgId);

      if (error) return '';
      return newCode;
    } catch (err) {
      console.error('Regenerate org code error:', err);
      return '';
    }
  },

  linkPaymentMethod: async (orgId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          payment_method_linked: true,
          auto_renew: true,
          subscription_status: 'ACTIVE',
          is_pro: true
        })
        .eq('id', orgId);

      return !error;
    } catch (err) {
      console.error('Link payment method error:', err);
      return false;
    }
  },

  cancelAutoRenew: async (orgId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ auto_renew: false })
        .eq('id', orgId);

      return !error;
    } catch (err) {
      console.error('Cancel auto renew error:', err);
      return false;
    }
  },

  // --- LOGS ---

  getLogs: async (userId?: string, orgId?: string): Promise<TimeLog[]> => {
    try {
      let query = supabase.from('time_logs').select('*');

      if (userId) query = query.eq('user_id', userId);
      if (orgId) query = query.eq('org_id', orgId);

      const { data, error } = await query;

      if (error || !data) return [];
      return data.map(dbTimeLogToTimeLog) as TimeLog[];
    } catch (err) {
      console.error('Get logs error:', err);
      return [];
    }
  },

  addLog: async (log: TimeLog): Promise<void> => {
    try {
      const { error } = await supabase
        .from('time_logs')
        .insert({
          user_id: log.userId,
          org_id: log.orgId,
          type: log.type,
          location: log.location,
          timestamp: new Date(log.timestamp).toISOString()
        });

      if (error) {
        console.error('Error adding log:', error);
      }
    } catch (err) {
      console.error('Add log error:', err);
    }
  },

  // --- LEAVES ---

  getLeaveRequests: async (userId?: string, orgId?: string): Promise<LeaveRequest[]> => {
    try {
      let query = supabase.from('leave_requests').select('*, users(name)');

      if (userId) query = query.eq('user_id', userId);
      if (orgId) query = query.eq('org_id', orgId);

      const { data, error } = await query;

      if (error || !data) return [];
      return data.map(l => dbLeaveToLeave(l, l.users?.name || 'Sconosciuto')) as LeaveRequest[];
    } catch (err) {
      console.error('Get leave requests error:', err);
      return [];
    }
  },

  addLeaveRequest: async (req: LeaveRequest): Promise<void> => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: req.userId,
          org_id: req.orgId,
          type: req.type,
          start_date: req.startDate,
          end_date: req.endDate,
          reason: req.reason,
          status: 'PENDING'
        });

      if (error) {
        console.error('Error adding leave request:', error);
      }
    } catch (err) {
      console.error('Add leave request error:', err);
    }
  },

  updateLeaveStatus: async (reqId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', reqId);

      if (error) {
        console.error('Error updating leave status:', error);
      }
    } catch (err) {
      console.error('Update leave status error:', err);
    }
  },

  // --- ADMIN ---

  getOrgEmployees: async (orgId: string): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('org_id', orgId)
        .eq('role', 'EMPLOYEE');

      if (error || !data) return [];
      return data.map(dbUserToUser) as User[];
    } catch (err) {
      console.error('Get org employees error:', err);
      return [];
    }
  },

  updateUserStatus: async (adminId: string, targetUserId: string, newStatus: UserStatus): Promise<void> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', targetUserId);

      if (error) {
        console.error('Error updating user status:', error);
      }
    } catch (err) {
      console.error('Update user status error:', err);
    }
  },

  removeUserFromOrg: async (targetUserId: string): Promise<void> => {
    try {
      // Delete associated logs
      await supabase
        .from('time_logs')
        .delete()
        .eq('user_id', targetUserId);

      // Delete user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', targetUserId);

      if (error) {
        console.error('Error removing user:', error);
      }
    } catch (err) {
      console.error('Remove user error:', err);
    }
  },

  // --- TUTORIAL ---

  completeTutorial: async (userId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ has_seen_tutorial: true })
        .eq('id', userId);

      if (error) {
        console.error('Error completing tutorial:', error);
      } else {
        // Update session if it's the current user
        const session = localStorage.getItem('workflow_session');
        if (session) {
          const user = JSON.parse(session);
          if (user.id === userId) {
            user.hasSeenTutorial = true;
            localStorage.setItem('workflow_session', JSON.stringify(user));
          }
        }
      }
    } catch (err) {
      console.error('Complete tutorial error:', err);
    }
  },

  // --- DATA ---

  exportDataAsCSV: async (userId: string | undefined, orgId: string | undefined, month: number | undefined, year: number | undefined, language: Language = 'IT'): Promise<string> => {
    try {
      const logs = await StorageService.getLogs(userId, orgId);
      const { data: users, error: usersError } = await supabase.from('users').select('*');

      if (usersError || !users) return '';

      let filteredLogs = logs;
      if (month !== undefined && year !== undefined) {
        const startDate = new Date(year, month, 1).getTime();
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

        filteredLogs = logs.filter(l => {
          const logTime = new Date(l.timestamp).getTime();
          return logTime >= startDate && logTime <= endDate;
        });
      }

      let csv = 'Data,Ora,Dipendente,CodiceFiscale,Azione,Luogo\n';
      const locale = language === 'EN' ? 'en-US' : language.toLowerCase();

      filteredLogs.sort((a, b) => a.timestamp - b.timestamp).forEach(log => {
        const user = users.find((u: any) => u.id === log.userId);
        const date = new Date(log.timestamp).toLocaleDateString(locale);
        const time = new Date(log.timestamp).toLocaleTimeString(locale);
        const userName = user ? user.name : 'Sconosciuto';
        const taxId = user ? (user.tax_id || 'N/A') : 'N/A';
        const location = log.location || '';
        csv += `"${date}","${time}","${userName}","${taxId}","${log.type}","${location}"\n`;
      });

      return csv;
    } catch (err) {
      console.error('Export data error:', err);
      return '';
    }
  },

  deleteAccount: async (userId: string): Promise<void> => {
    try {
      // Delete logs
      await supabase
        .from('time_logs')
        .delete()
        .eq('user_id', userId);

      // Delete leave requests
      await supabase
        .from('leave_requests')
        .delete()
        .eq('user_id', userId);

      // Delete user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting account:', error);
      } else {
        localStorage.removeItem('workflow_session');
      }
    } catch (err) {
      console.error('Delete account error:', err);
    }
  }
};
