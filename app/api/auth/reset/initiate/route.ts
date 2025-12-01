import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/server/supabaseServer';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Missing' }, { status: 400 });
    const supabase = supabaseServer();
    const { data: user } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (!user) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase.from('users').update({ reset_code: code }).eq('id', user.id);
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ success: true, demoCode: code });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
