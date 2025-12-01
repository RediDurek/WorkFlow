import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    const supabase = supabaseServer();
    const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.verification_code !== code) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

    const { error } = await supabase.from('users').update({ is_email_verified: true, verification_code: null }).eq('id', user.id);
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    // create a session token now that the user is verified
    let token: string;
    try {
      token = typeof randomUUID === 'function' ? randomUUID() : Math.random().toString(36).slice(2);
    } catch {
      token = Math.random().toString(36).slice(2);
    }
    const { error: sessErr } = await supabase.from('sessions').insert({ id: token, user_id: user.id });
    if (sessErr) {
      console.error('Session insert error:', sessErr);
      return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }

    const updated = { ...user, is_email_verified: true, verification_code: null };
    const res = NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email, orgId: updated.org_id, role: updated.role, status: updated.status, isEmailVerified: true } });
    res.cookies.set('wf_session', token, { httpOnly: true, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
