import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

export async function POST() {
  try {
    const user = await requireSessionUser();
    const supabase = supabaseServer();
    const { error } = await supabase.from('users').update({ has_seen_tutorial: true }).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
