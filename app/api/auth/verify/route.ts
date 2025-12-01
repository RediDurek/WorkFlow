import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';

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

    if (user.role === 'ADMIN') {
      const updated = { ...user, is_email_verified: true, verification_code: null };
      return NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email, orgId: updated.org_id, role: updated.role, status: updated.status, isEmailVerified: true } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
