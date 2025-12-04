import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function PATCH(req: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { targetUserId, contractType, contractEndDate } = body || {};
    if (!targetUserId || !contractType) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = supabaseServer();
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        contract_type: contractType,
        contract_end_date: contractType === 'DETERMINATO' ? (contractEndDate || null) : null,
        status: 'ACTIVE'
      })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // Notify the employee that contract has been set/updated
    if (updatedUser) {
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        org_id: user.orgId,
        type: 'CONTRACT_UPDATED',
        title: 'Contratto aggiornato',
        body: contractType === 'DETERMINATO'
          ? `Contratto a termine - scadenza ${contractEndDate || 'N/D'}`
          : 'Contratto a tempo indeterminato'
      });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
