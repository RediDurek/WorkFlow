import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');
    if (!targetUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const supabase = supabaseServer();
    const { data, error } = await supabase.from('user_roles').select('org_role_id').eq('user_id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { targetUserId, roleIds } = body || {};
    if (!targetUserId || !Array.isArray(roleIds)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const supabase = supabaseServer();
    await supabase.from('user_roles').delete().eq('user_id', targetUserId);
    if (roleIds.length > 0) {
      const rows = roleIds.map((rid: string) => ({ user_id: targetUserId, org_role_id: rid }));
      const { error } = await supabase.from('user_roles').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
