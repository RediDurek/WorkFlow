
import { TimeLog, LeaveRequest, User, Organization, LogType, UserStatus, SubscriptionStatus, Language, LeaveType } from '../types';

const KEYS = {
  SESSION: 'workflow_session',
  USERS: 'workflow_users_db',
  ORGS: 'workflow_orgs_db',
  LOGS: 'workflow_logs_db',
  LEAVES: 'workflow_leaves_db'
};

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generateAuthCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashPassword = async (pass: string) => {
  const msgBuffer = new TextEncoder().encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const StorageService = {
  // --- AUTH & SESSION ---

  getSessionUser: async (): Promise<User | null> => {
    await delay(100);
    const stored = localStorage.getItem(KEYS.SESSION);
    return stored ? JSON.parse(stored) : null;
  },

  login: async (email: string, pass: string): Promise<{ user: User | null; error?: string }> => {
    await delay(800);
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const passwordHash = await hashPassword(pass);
    
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === passwordHash);
    
    if (user) {
      if (!user.isEmailVerified) return { user: null, error: 'Email non verificata' }; 
      if (user.role === 'EMPLOYEE' && user.status === 'PENDING_APPROVAL') return { user: null, error: 'In attesa di approvazione.' };
      if (user.status === 'BLOCKED') return { user: null, error: 'Account bloccato.' };

      localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
      return { user };
    }
    return { user: null, error: 'Email o password errati' };
  },

  logout: async (): Promise<void> => {
    await delay(200);
    localStorage.removeItem(KEYS.SESSION);
  },

  // --- REGISTRATION ---

  registerOrg: async (orgName: string, adminName: string, email: string, pass: string, taxId: string): Promise<{ success: boolean; email?: string; error?: string; demoCode?: string }> => {
    await delay(1000);
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');

    if (users.find(u => u.email === email)) return { success: false, error: 'Email già registrata' };

    const trialDuration = 5 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const newOrg: Organization = {
      id: crypto.randomUUID(),
      name: orgName,
      code: generateCode(),
      createdAt: now,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: now + trialDuration,
      isPro: true, 
      paymentMethodLinked: false,
      autoRenew: true,
      taxId: taxId // Salviamo la P.IVA/CF ma non controlliamo univocità globale per evitare blocchi dolosi
    };

    const passwordHash = await hashPassword(pass);
    const verificationCode = generateAuthCode();

    const newUser: User = {
      id: crypto.randomUUID(),
      orgId: newOrg.id,
      name: adminName,
      email,
      taxId,
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: false,
      verificationCode,
      privacyAccepted: true,
      hasSeenTutorial: false,
      createdAt: now
    };

    orgs.push(newOrg);
    users.push(newUser);

    localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    
    return { success: true, email: newUser.email, demoCode: verificationCode };
  },

  joinOrg: async (orgCode: string, name: string, email: string, pass: string, taxId: string): Promise<{ success: boolean; email?: string; error?: string; demoCode?: string }> => {
    await delay(1000);
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');

    if (users.find(u => u.email === email)) return { success: false, error: 'Email già registrata' };
    
    const org = orgs.find(o => o.code === orgCode);
    if (!org) return { success: false, error: 'Codice Azienda non valido' };

    // FIX: Check Tax ID uniqueness ONLY within the specific Organization
    // This allows the same person (same Tax ID) to be employed in multiple companies with different accounts.
    if (taxId && users.find(u => u.taxId === taxId && u.orgId === org.id)) {
        return { success: false, error: 'Codice Fiscale già presente in questa azienda.' };
    }

    const now = Date.now();
    const isTrialActive = org.subscriptionStatus === 'TRIAL' && now < org.trialEndsAt;
    const isPro = (org.subscriptionStatus === 'ACTIVE' || isTrialActive);

    const orgEmployees = users.filter(u => u.orgId === org.id && u.role === 'EMPLOYEE');
    if (!isPro && orgEmployees.length >= 3) {
        return { success: false, error: 'Limite dipendenti raggiunto.' };
    }

    const passwordHash = await hashPassword(pass);
    const verificationCode = generateAuthCode();

    const newUser: User = {
      id: crypto.randomUUID(),
      orgId: org.id,
      name,
      email,
      taxId,
      password: passwordHash,
      role: 'EMPLOYEE',
      status: 'PENDING_APPROVAL',
      isEmailVerified: false,
      verificationCode,
      privacyAccepted: true,
      hasSeenTutorial: false,
      createdAt: now
    };

    users.push(newUser);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));

    return { success: true, email: newUser.email, demoCode: verificationCode };
  },

  verifyEmail: async (email: string, code: string): Promise<{ user: User | null; error?: string }> => {
    await delay(800);
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) return { user: null, error: 'Utente non trovato' };
    const user = users[userIndex];
    if (user.verificationCode !== code) return { user: null, error: 'Codice non valido' };

    user.isEmailVerified = true;
    user.verificationCode = undefined;
    users[userIndex] = user;
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    
    if (user.role === 'ADMIN') {
        localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
        return { user };
    } else {
        return { user: null, error: 'Email verificata! Attendi l\'approvazione.' };
    }
  },

  resendCode: async (email: string): Promise<string | null> => {
     await delay(500);
     const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
     const user = users.find(u => u.email === email);
     if(user) {
        const newCode = generateAuthCode();
        user.verificationCode = newCode;
        localStorage.setItem(KEYS.USERS, JSON.stringify(users));
        return newCode;
     }
     return null;
  },
  
  // --- PASSWORD RESET ---
  
  initiatePasswordReset: async (email: string): Promise<{ success: boolean; demoCode?: string; error?: string }> => {
      await delay(1000);
      const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (userIndex === -1) {
          // Per sicurezza non diciamo se l'email non esiste
          return { success: false, error: 'Email non trovata.' };
      }
      
      const code = generateAuthCode();
      users[userIndex].resetCode = code;
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      
      return { success: true, demoCode: code };
  },
  
  completePasswordReset: async (email: string, code: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
      await delay(1000);
      const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (userIndex === -1) return { success: false, error: 'Utente non trovato' };
      
      if (users[userIndex].resetCode !== code) return { success: false, error: 'Codice non valido' };
      
      const passwordHash = await hashPassword(newPass);
      users[userIndex].password = passwordHash;
      users[userIndex].resetCode = undefined; // Pulisci il codice
      
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      return { success: true };
  },

  // --- ORGANIZATION & SUBSCRIPTION ---

  getOrganization: (orgId: string): Organization | undefined => {
    const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');
    let org = orgs.find(o => o.id === orgId);
    
    if (org) {
        const now = Date.now();
        if (org.subscriptionStatus === 'TRIAL' && now > org.trialEndsAt) {
            org.subscriptionStatus = 'EXPIRED';
            org.isPro = false;
            // Persist expiration
            const index = orgs.findIndex(o => o.id === orgId);
            orgs[index] = org;
            localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
        } else if (org.subscriptionStatus === 'TRIAL') {
            org.isPro = true;
        }
    }
    return org;
  },

  regenerateOrgCode: async (orgId: string): Promise<string> => {
     await delay(500);
     const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');
     const index = orgs.findIndex(o => o.id === orgId);
     if (index !== -1) {
         const newCode = generateCode();
         orgs[index].code = newCode;
         localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
         return newCode;
     }
     return "";
  },

  linkPaymentMethod: async (orgId: string): Promise<boolean> => {
      await delay(1500);
      const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');
      const index = orgs.findIndex(o => o.id === orgId);
      if (index !== -1) {
          orgs[index].paymentMethodLinked = true;
          orgs[index].autoRenew = true;
          if (orgs[index].subscriptionStatus === 'EXPIRED') {
             orgs[index].subscriptionStatus = 'ACTIVE';
             orgs[index].isPro = true;
          }
          localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
          return true;
      }
      return false;
  },

  cancelAutoRenew: async (orgId: string): Promise<boolean> => {
      await delay(500);
      const orgs: Organization[] = JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');
      const index = orgs.findIndex(o => o.id === orgId);
      if (index !== -1) {
          orgs[index].autoRenew = false;
          localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
          return true;
      }
      return false;
  },

  // --- LOGS ---

  getLogs: (userId?: string, orgId?: string): TimeLog[] => {
    const logs: TimeLog[] = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
    if (userId) return logs.filter(l => l.userId === userId);
    if (orgId) return logs.filter(l => l.orgId === orgId);
    return [];
  },

  addLog: async (log: TimeLog): Promise<void> => {
    await delay(200);
    const logs = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
    logs.push(log);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  // --- LEAVES ---

  getLeaveRequests: (userId?: string, orgId?: string): LeaveRequest[] => {
    const leaves: LeaveRequest[] = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
    if (userId) return leaves.filter(l => l.userId === userId);
    if (orgId) return leaves.filter(l => l.orgId === orgId);
    return [];
  },

  addLeaveRequest: async (req: LeaveRequest): Promise<void> => {
    await delay(300);
    const leaves = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
    leaves.push(req);
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(leaves));
  },

  updateLeaveStatus: async (reqId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> => {
    await delay(300);
    const leaves: LeaveRequest[] = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
    const index = leaves.findIndex(l => l.id === reqId);
    if (index !== -1) {
      leaves[index].status = status;
      localStorage.setItem(KEYS.LEAVES, JSON.stringify(leaves));
    }
  },

  // --- ADMIN ---

  getOrgEmployees: (orgId: string): User[] => {
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    return users.filter(u => u.orgId === orgId && u.role === 'EMPLOYEE');
  },

  updateUserStatus: async (adminId: string, targetUserId: string, newStatus: UserStatus): Promise<void> => {
    await delay(400);
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const targetIndex = users.findIndex(u => u.id === targetUserId);
    if (targetIndex !== -1) {
       users[targetIndex].status = newStatus;
       localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    }
  },

  removeUserFromOrg: async (targetUserId: string): Promise<void> => {
      await delay(400);
      let users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      // Filter out the user to delete
      users = users.filter(u => u.id !== targetUserId);
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      
      let logs: TimeLog[] = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
      logs = logs.filter(l => l.userId !== targetUserId);
      localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  // --- TUTORIAL ---
  completeTutorial: async (userId: string): Promise<void> => {
    const users: User[] = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
        users[index].hasSeenTutorial = true;
        localStorage.setItem(KEYS.USERS, JSON.stringify(users));
        
        // Update Session if it's the current user
        const session = JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null');
        if (session && session.id === userId) {
            session.hasSeenTutorial = true;
            localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
        }
    }
  },

  // --- DATA ---

  exportDataAsCSV: (userId: string | undefined, orgId: string | undefined, month: number | undefined, year: number | undefined, language: Language = 'IT'): string => {
    const logs = StorageService.getLogs(userId, orgId);
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    
    // Filter by Date if provided
    let filteredLogs = logs;
    if (month !== undefined && year !== undefined) {
        const startDate = new Date(year, month, 1).getTime();
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
        
        filteredLogs = logs.filter(l => l.timestamp >= startDate && l.timestamp <= endDate);
    }
    
    let csv = "Data,Ora,Dipendente,CodiceFiscale,Azione,Luogo\n";
    // Determine locale for date formatting
    const locale = language === 'EN' ? 'en-US' : language.toLowerCase();

    filteredLogs.sort((a,b) => a.timestamp - b.timestamp).forEach(log => {
        const user = users.find((u: User) => u.id === log.userId);
        const date = new Date(log.timestamp).toLocaleDateString(locale);
        const time = new Date(log.timestamp).toLocaleTimeString(locale);
        const userName = user ? user.name : "Sconosciuto";
        const taxId = user ? (user.taxId || "N/A") : "N/A";
        const location = log.location || "";
        csv += `"${date}","${time}","${userName}","${taxId}","${log.type}","${location}"\n`;
    });
    return csv;
  },

  deleteAccount: async (userId: string): Promise<void> => {
      await delay(1000);
      let users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      let logs = JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
      let leaves = JSON.parse(localStorage.getItem(KEYS.LEAVES) || '[]');
      users = users.filter((u: User) => u.id !== userId);
      logs = logs.filter((l: TimeLog) => l.userId !== userId);
      leaves = leaves.filter((l: LeaveRequest) => l.userId !== userId);
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
      localStorage.setItem(KEYS.LEAVES, JSON.stringify(leaves));
      localStorage.removeItem(KEYS.SESSION);
  }
};
