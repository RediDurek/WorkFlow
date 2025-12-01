import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    const supabase = supabaseServer();
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase.from('users').update({ verification_code: newCode }).eq('email', email.toLowerCase());
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ code: newCode });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
