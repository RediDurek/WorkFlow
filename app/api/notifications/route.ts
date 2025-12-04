import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const mapped = (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      orgId: n.org_id,
      type: n.type,
      title: n.title,
      body: n.body,
      readAt: n.read_at ? new Date(n.read_at).getTime() : null,
      createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
    }));
    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireSessionUser();
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};
    const supabase = supabaseServer();
    const query = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (id) query.eq('id', id);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
