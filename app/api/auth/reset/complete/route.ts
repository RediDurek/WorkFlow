import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/server/supabaseServer';
import { hashPassword } from '../../../../../../lib/server/hash';

export async function POST(req: Request) {
  try {
    const { email, code, newPass } = await req.json();
    if (!email || !code || !newPass) return NextResponse.json({ error: 'Missing' }, { status: 400 });
    const supabase = supabaseServer();
    const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.reset_code !== code) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    const hashed = hashPassword(newPass);
    const { error } = await supabase.from('users').update({ password: hashed, reset_code: null }).eq('id', user.id);
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
