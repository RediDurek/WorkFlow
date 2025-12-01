import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';

export interface SessionUser {
  id: string;
  orgId: string;
  role: 'ADMIN' | 'EMPLOYEE';
  status: string;
}

/**
 * Reads the session cookie, fetches the user via service role, returns basic info.
 * Returns null if no session or user not found.
 */
export const getSessionUser = async (): Promise<SessionUser | null> => {
  const token = cookies().get('wf_session')?.value;
  if (!token) return null;

  const supabase = supabaseServer();
  const { data: session } = await supabase.from('sessions').select('user_id').eq('id', token).single();
  if (!session?.user_id) return null;

  const { data: user } = await supabase.from('users').select('*').eq('id', session.user_id).single();
  if (!user) return null;

  return {
    id: user.id,
    orgId: user.org_id,
    role: user.role,
    status: user.status
  };
};

export const requireSessionUser = async (): Promise<SessionUser> => {
  const u = await getSessionUser();
  if (!u) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return u;
};
