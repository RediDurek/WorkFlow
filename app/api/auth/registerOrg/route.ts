import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { hashPassword } from '../../../../lib/server/hash';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgName, adminName, email, password, taxId } = body;
    if (!orgName || !adminName || !email || !password) return NextResponse.json({ error: 'Missing' }, { status: 400 });

    const supabase = supabaseServer();

    // check existing email
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase());
    if (existing && existing.length > 0) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    const trialDuration = 5 * 24 * 60 * 60 * 1000;
    const trialEndsAt = new Date(Date.now() + trialDuration).toISOString();

    const { data: org, error: orgErr } = await supabase.from('organizations').insert({ name: orgName, code: Math.random().toString(36).substring(2,8).toUpperCase(), tax_id: taxId, subscription_status: 'TRIAL', trial_ends_at: trialEndsAt, is_pro: true, payment_method_linked: false, auto_renew: true }).select().single();
    if (orgErr || !org) return NextResponse.json({ error: 'Org creation failed' }, { status: 500 });

    const hashed = hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: user, error: userErr } = await supabase.from('users').insert({ org_id: org.id, name: adminName, email: email.toLowerCase(), tax_id: taxId, password: hashed, role: 'ADMIN', status: 'ACTIVE', is_email_verified: false, verification_code: verificationCode, privacy_accepted: true, has_seen_tutorial: false }).select().single();
    if (userErr || !user) return NextResponse.json({ error: 'User creation failed' }, { status: 500 });

    return NextResponse.json({ success: true, email: user.email, demoCode: verificationCode });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
