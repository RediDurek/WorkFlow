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

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie');
    const token = parseCookie(cookieHeader, 'wf_session');
    if (!token) return NextResponse.json({ success: true });

    const supabase = supabaseServer();
    await supabase.from('sessions').delete().eq('id', token);

    const res = NextResponse.json({ success: true });
    // clear cookie
    res.cookies.set('wf_session', '', { path: '/', httpOnly: true, expires: new Date(0) });
    return res;
  } catch (err: any) {
    console.error('Logout route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
