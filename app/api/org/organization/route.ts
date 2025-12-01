import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    if (orgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = supabaseServer();
    const { data: org, error } = await supabase.from('organizations').select('*').eq('id', orgId).single();
    if (error || !org) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });

    const now = new Date();
    if (org.subscription_status === 'TRIAL' && new Date(org.trial_ends_at) < now) {
      await supabase.from('organizations').update({ subscription_status: 'EXPIRED', is_pro: false }).eq('id', orgId);
      org.subscription_status = 'EXPIRED';
      org.is_pro = false;
    } else if (org.subscription_status === 'TRIAL') {
      org.is_pro = true;
    }

    return NextResponse.json({ data: org });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
