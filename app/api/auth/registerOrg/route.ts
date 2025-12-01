import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { hashPassword } from '../../../../lib/server/hash';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgName, adminName, email, password, taxId } = body;
    if (!orgName || !adminName || !email || !password) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    // quick sanity check for required env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY) {
      const msg = 'Supabase server config missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY';
      console.error(msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const supabase = supabaseServer();

    // check existing email
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase());
    if (existing && existing.length > 0) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    const trialDuration = 5 * 24 * 60 * 60 * 1000;
    const trialEndsAt = new Date(Date.now() + trialDuration).toISOString();

    const { data: org, error: orgErr } = await supabase.from('organizations').insert({ name: orgName, code: Math.random().toString(36).substring(2,8).toUpperCase(), tax_id: taxId, subscription_status: 'TRIAL', trial_ends_at: trialEndsAt, is_pro: true, payment_method_linked: false, auto_renew: true }).select().single();
    if (orgErr || !org) {
      console.error('Org insert error:', orgErr);
      const message = process.env.NODE_ENV === 'production' ? 'Org creation failed' : (orgErr?.message || JSON.stringify(orgErr));
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const hashed = hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: user, error: userErr } = await supabase.from('users').insert({ org_id: org.id, name: adminName, email: email.toLowerCase(), tax_id: taxId, password: hashed, role: 'ADMIN', status: 'ACTIVE', is_email_verified: false, verification_code: verificationCode, privacy_accepted: true, has_seen_tutorial: false, contract_type: 'INDETERMINATO', contract_end_date: null }).select().single();
    if (userErr || !user) {
      console.error('User insert error:', userErr);
      const message = process.env.NODE_ENV === 'production' ? 'User creation failed' : (userErr?.message || JSON.stringify(userErr));
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Do NOT create a session here. The session will be created after email verification.
    const respBody: any = { success: true, email: user.email };
    if (process.env.NODE_ENV !== 'production') respBody.demoCode = verificationCode;
    return NextResponse.json(respBody);
  } catch (err: any) {
    console.error('registerOrg route error:', err);
    const msg = process.env.NODE_ENV === 'production' ? 'Server error' : (err?.message || String(err));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
