import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const orgId = searchParams.get('orgId');

    if (user.role !== 'ADMIN') {
      if (userId && userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (orgId && orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    let query = supabase.from('leave_requests').select('*, users(name)');
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
    const { request } = body || {};
    if (!request?.userId || !request?.orgId || !request?.type || !request?.startDate || !request?.endDate) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (user.role !== 'ADMIN') {
      if (request.userId !== user.id || request.orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      if (request.orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase.from('leave_requests').insert({
      user_id: request.userId,
      org_id: request.orgId,
      type: request.type,
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason || '',
      status: 'PENDING'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
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
    const { reqId, status } = body || {};
    if (!reqId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', reqId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
