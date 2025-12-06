import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

// Schema idea: time_adjustments(id, org_id, user_id, date, clock_in, clock_out, reason, status, approver_id, created_at, reviewed_at)

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    const supabase = supabaseServer();
    let query = supabase.from('time_adjustments').select('*').eq('org_id', user.orgId);
    if (user.role === 'EMPLOYEE') {
      query = query.eq('user_id', user.id);
    } else if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
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
    if (user.role !== 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { date, clockInNew, clockOutNew, clockInOld, clockOutOld, pauseStart, pauseEnd, pauseStartNew, pauseEndNew, reason } = body || {};
    if (!date || !clockInNew || !clockOutNew || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const { error } = await supabase.from('time_adjustments').insert({
      org_id: user.orgId,
      user_id: user.id,
      date,
      clock_in_old: clockInOld,
      clock_out_old: clockOutOld,
      pause_start_old: pauseStart || null,
      pause_end_old: pauseEnd || null,
      clock_in_new: clockInNew,
      clock_out_new: clockOutNew,
      pause_start: pauseStartNew || pauseStart || null,
      pause_end: pauseEndNew || pauseEnd || null,
      clock_in: clockInNew,
      clock_out: clockOutNew,
      reason,
      status: 'PENDING'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // notify admins
    const { data: admins } = await supabase.from('users').select('id').eq('org_id', user.orgId).eq('role', 'ADMIN');
    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          org_id: user.orgId,
          type: 'ADJUSTMENT_CREATED',
          title: 'Richiesta correzione ore',
          body: `${date} - ${user.id}`
        }))
      );
    }

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
    const { id, status } = body || {};
    if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const { data: existing } = await supabase
      .from('time_adjustments')
      .select('*')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('time_adjustments')
      .update({ status, approver_id: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select('user_id, org_id, date, clock_in_new, clock_out_new, pause_start, pause_end')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // apply logs on approval
    if (status === 'APPROVED' && data?.user_id) {
      const startTs = new Date(`${data.date}T${data.clock_in_new}:00`).toISOString();
      const endTs = new Date(`${data.date}T${data.clock_out_new}:00`).toISOString();
      const pauseStartTs = data.pause_start ? new Date(`${data.date}T${data.pause_start}:00`).toISOString() : null;
      const pauseEndTs = data.pause_end ? new Date(`${data.date}T${data.pause_end}:00`).toISOString() : null;
      const startOfDay = new Date(`${data.date}T00:00:00`).toISOString();
      const endOfDay = new Date(`${data.date}T23:59:59`).toISOString();
      // remove existing logs of the day
      await supabase.from('time_logs').delete().eq('user_id', data.user_id).eq('org_id', user.orgId).gte('timestamp', startOfDay).lte('timestamp', endOfDay);
      // insert corrected logs (with optional pause)
      if (pauseStartTs && pauseEndTs) {
        await supabase.from('time_logs').insert([
          { user_id: data.user_id, org_id: data.org_id, timestamp: startTs, type: 'CLOCK_IN' },
          { user_id: data.user_id, org_id: data.org_id, timestamp: pauseStartTs, type: 'START_BREAK' },
          { user_id: data.user_id, org_id: data.org_id, timestamp: pauseEndTs, type: 'END_BREAK' },
          { user_id: data.user_id, org_id: data.org_id, timestamp: endTs, type: 'CLOCK_OUT' },
        ]);
      } else {
        await supabase.from('time_logs').insert([
          { user_id: data.user_id, org_id: data.org_id, timestamp: startTs, type: 'CLOCK_IN' },
          { user_id: data.user_id, org_id: data.org_id, timestamp: endTs, type: 'CLOCK_OUT' },
        ]);
      }
    }

    // notify employee
    if (data?.user_id) {
      await supabase.from('notifications').insert({
        user_id: data.user_id,
        org_id: data.org_id,
        type: 'ADJUSTMENT_UPDATED',
        title: status === 'APPROVED' ? 'Correzione approvata' : 'Correzione rifiutata',
        body: data.date
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
