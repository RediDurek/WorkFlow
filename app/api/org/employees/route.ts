import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('org_id', user.orgId)
      .eq('role', 'EMPLOYEE');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { targetUserId, status } = body || {};
    if (!targetUserId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const { error } = await supabase.from('users').update({ status }).eq('id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');
    if (!targetUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabase = supabaseServer();
    await supabase.from('time_logs').delete().eq('user_id', targetUserId);
    await supabase.from('leave_requests').delete().eq('user_id', targetUserId);
    const { error } = await supabase.from('users').delete().eq('id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
