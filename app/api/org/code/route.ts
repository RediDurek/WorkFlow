import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function POST() {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const supabase = supabaseServer();
    const { error } = await supabase.from('organizations').update({ code: newCode }).eq('id', user.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ code: newCode });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
