import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const orgId = searchParams.get('orgId');

    // Authorization: employees can only read their logs; admins only within own org
    if (user.role !== 'ADMIN') {
      if (userId && userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (orgId && orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    let query = supabase.from('time_logs').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
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
    const body = await req.json();
    const { log } = body || {};
    if (!log?.userId || !log?.orgId || !log?.timestamp || !log?.type) {
      return NextResponse.json({ error: 'Missing log fields' }, { status: 400 });
    }
    // Authorization: only self or admin in same org
    if (user.role !== 'ADMIN') {
      if (log.userId !== user.id || log.orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      if (log.orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase.from('time_logs').insert({
      id: log.id,
      user_id: log.userId,
      org_id: log.orgId,
      type: log.type,
      location: log.location || null,
      timestamp: new Date(log.timestamp).toISOString()
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
