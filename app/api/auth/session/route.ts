import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';

function parseCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';').map(p => p.trim());
  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie');
    const token = parseCookie(cookieHeader, 'wf_session');
    if (!token) return NextResponse.json({ user: null }, { status: 200 });

    const supabase = supabaseServer();
    const { data: session } = await supabase.from('sessions').select('*').eq('id', token).single();
    if (!session) return NextResponse.json({ user: null }, { status: 200 });

    const { data: user } = await supabase.from('users').select('*').eq('id', session.user_id).single();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });

    // map to camelCase minimal user
    const mapped = { id: user.id, name: user.name, email: user.email, orgId: user.org_id, role: user.role, status: user.status, isEmailVerified: user.is_email_verified };
    return NextResponse.json({ user: mapped });
  } catch (err: any) {
    console.error('Session route error:', err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
