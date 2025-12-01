
export enum WorkStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  ON_BREAK = 'ON_BREAK'
}

export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  START_BREAK = 'START_BREAK',
  END_BREAK = 'END_BREAK'
}

export interface TimeLog {
  id: string;
  userId: string;
  orgId: string;
  timestamp: number;
  type: LogType;
  dateString: string;
  location?: string;
}

export enum LeaveType {
  VACATION = 'Ferie',
  PERMIT = 'Permesso',
  SICK = 'Malattia'
}

export interface LeaveRequest {
  id: string;
  userId: string;
  orgId: string;
  userName: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  attachment?: string; 
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface Organization {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: number;
  isPro: boolean;
  paymentMethodLinked: boolean;
  autoRenew: boolean;
  taxId?: string; // P.IVA o Codice Fiscale Azienda
}

export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  taxId?: string; // Codice Fiscale
  role: 'EMPLOYEE' | 'ADMIN';
  password?: string; 
  status: UserStatus;
  isEmailVerified: boolean;
  verificationCode?: string;
  resetCode?: string; 
  privacyAccepted: boolean;
  hasSeenTutorial: boolean;
  contractType?: 'DETERMINATO' | 'INDETERMINATO';
  contractEndDate?: string;
  createdAt: number;
}

export interface UserStats {
  userId: string;
  userName: string;
  taxId?: string;
  currentStatus: WorkStatus;
  lastActive: number;
  totalHours: number;
  daysWorked: number;
  currentLocation?: string;
  userStatus: UserStatus;
}

export type Language = 'IT' | 'EN' | 'ES' | 'FR' | 'DE';
