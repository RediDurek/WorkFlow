import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { hashPassword } from '../../../../lib/server/hash';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    const supabase = supabaseServer();
    const hashed = hashPassword(password);
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).eq('password', hashed).single();
    if (error || !user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    if (!user.is_email_verified) return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
    if (user.status === 'BLOCKED') return NextResponse.json({ error: 'Account blocked' }, { status: 403 });

    // create session token (use Node crypto.randomUUID when available)
    let token: string;
    try {
      token = typeof randomUUID === 'function' ? randomUUID() : Math.random().toString(36).slice(2);
    } catch {
      token = Math.random().toString(36).slice(2);
    }
    await supabase.from('sessions').insert({ id: token, user_id: user.id });

    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, orgId: user.org_id, role: user.role, status: user.status, isEmailVerified: user.is_email_verified } });
    res.cookies.set('wf_session', token, { httpOnly: true, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res;
  } catch (err: any) {
    // Log server error to console for debugging
    console.error('Login route error:', err);
    const msg = process.env.NODE_ENV === 'production' ? 'Server error' : (err?.message || String(err));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
