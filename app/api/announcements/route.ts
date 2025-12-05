import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../lib/server/auth';

const mapAnnouncement = (row: any) => ({
  id: row.id,
  orgId: row.org_id,
  authorId: row.author_id,
  title: row.title,
  body: row.body,
  audienceRoleIds: row.audience_roles || [],
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // fetch user roles for filtering
    const { data: rolesData } = await supabase.from('user_roles').select('org_role_id').eq('user_id', user.id);
    const myRoles = new Set((rolesData || []).map(r => r.org_role_id));

    const filtered = (data || []).filter(a => {
      if (user.role === 'ADMIN') return true;
      const audience = a.audience_roles || [];
      if (!audience || audience.length === 0) return true;
      return audience.some((rid: string) => myRoles.has(rid));
    }).map(mapAnnouncement);

    return NextResponse.json({ data: filtered });
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
    const { title, body: content, audienceRoleIds } = body || {};
    if (!title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const audience = Array.isArray(audienceRoleIds) ? audienceRoleIds : [];
    const { error } = await supabase.from('announcements').insert({
      org_id: user.orgId,
      author_id: user.id,
      title,
      body: content,
      audience_roles: audience
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Notify recipients
    let targetUserIds: string[] = [];
    if (audience.length === 0) {
      const { data: users } = await supabase.from('users').select('id').eq('org_id', user.orgId).eq('role', 'EMPLOYEE');
      targetUserIds = (users || []).map(u => u.id);
    } else {
      const { data: mapped } = await supabase.from('user_roles').select('user_id').in('org_role_id', audience);
      targetUserIds = Array.from(new Set((mapped || []).map(m => m.user_id)));
    }
    if (targetUserIds.length > 0) {
      const rows = targetUserIds.map(uid => ({
        user_id: uid,
        org_id: user.orgId,
        type: 'ANNOUNCEMENT_NEW',
        title,
        body: content.slice(0, 140)
      }));
      await supabase.from('notifications').insert(rows);
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
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};
    const supabase = supabaseServer();

    // Mark notifications related to announcements as read for this user
    let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).like('type', 'ANNOUNCEMENT_%');
    if (id) {
      query = query.eq('related_id', id);
    }
    await query;

    // Optionally store a read receipt
    if (id) {
      try {
        await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: 'announcement_id,user_id' });
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
