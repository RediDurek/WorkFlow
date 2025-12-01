import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { hashPassword } from '../../../../lib/server/hash';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgCode, name, email, password, taxId, contractType, contractEndDate } = body;
    if (!orgCode || !name || !email || !password) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    const supabase = supabaseServer();

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase());
    if (existing && existing.length > 0) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    const { data: org } = await supabase.from('organizations').select('*').eq('code', orgCode).single();
    if (!org) return NextResponse.json({ error: 'Invalid org code' }, { status: 400 });

    if (taxId) {
      const { data: existingTax } = await supabase.from('users').select('id').eq('tax_id', taxId).eq('org_id', org.id);
      if (existingTax && existingTax.length > 0) return NextResponse.json({ error: 'Tax ID exists in org' }, { status: 400 });
    }

    const now = new Date();
    const isTrialActive = org.subscription_status === 'TRIAL' && new Date(org.trial_ends_at) > now;
    const isPro = org.subscription_status === 'ACTIVE' || isTrialActive;
    if (!isPro) {
      const { data: employees } = await supabase.from('users').select('id').eq('org_id', org.id).eq('role', 'EMPLOYEE');
      if (employees && employees.length >= 3) return NextResponse.json({ error: 'Employee limit reached' }, { status: 400 });
    }

    const hashed = hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: user, error: userErr } = await supabase.from('users').insert({ org_id: org.id, name, email: email.toLowerCase(), tax_id: taxId, password: hashed, role: 'EMPLOYEE', status: 'PENDING_APPROVAL', is_email_verified: false, verification_code: verificationCode, privacy_accepted: true, has_seen_tutorial: false, contract_type: body.contractType || 'INDETERMINATO', contract_end_date: body.contractEndDate || null }).select().single();
    if (userErr || !user) return NextResponse.json({ error: 'User creation failed' }, { status: 500 });

    return NextResponse.json({ success: true, email: user.email, demoCode: verificationCode });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
