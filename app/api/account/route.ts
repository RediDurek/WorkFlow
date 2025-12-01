import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

export async function DELETE() {
  try {
    const user = await requireSessionUser();
    const supabase = supabaseServer();
    await supabase.from('time_logs').delete().eq('user_id', user.id);
    await supabase.from('leave_requests').delete().eq('user_id', user.id);
    const { error } = await supabase.from('users').delete().eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('sessions').delete().eq('user_id', user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
