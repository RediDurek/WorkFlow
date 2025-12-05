import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('org_roles')
      .select('*')
      .eq('org_id', user.orgId)
      .order('position', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    let roles = data || [];
    if (roles.length === 0) {
      // ensure a default/base role exists
      const { error: insertErr, data: inserted } = await supabase
        .from('org_roles')
        .insert({ org_id: user.orgId, name: 'Base', position: 1 })
        .select('*');
      if (!insertErr && inserted) roles = inserted;
    }
    return NextResponse.json({ data: roles });
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
    const { name } = body || {};
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    const supabase = supabaseServer();
    const { data: maxPos } = await supabase
      .from('org_roles')
      .select('position')
      .eq('org_id', user.orgId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (maxPos?.position ?? 0) + 1;
    const { error } = await supabase.from('org_roles').insert({ org_id: user.orgId, name, position });
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
    const { id, name, position } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const supabase = supabaseServer();
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (position !== undefined) update.position = position;
    const { error } = await supabase.from('org_roles').update(update).eq('id', id).eq('org_id', user.orgId);
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
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const supabase = supabaseServer();
    await supabase.from('user_roles').delete().eq('org_role_id', id);
    const { error } = await supabase.from('org_roles').delete().eq('id', id).eq('org_id', user.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
