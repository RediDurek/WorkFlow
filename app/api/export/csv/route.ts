import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/server/supabaseServer';
import { requireSessionUser } from '../../../../lib/server/auth';

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId') || undefined;
    const orgIdParam = searchParams.get('orgId') || undefined;
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const language = (searchParams.get('lang') || 'IT') as any;

    // Authorization + scope: admin limited to own org; employees only self
    const scopedOrgId = orgIdParam || user.orgId;
    if (user.role !== 'ADMIN') {
      if (userIdParam && userIdParam !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (scopedOrgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      if (scopedOrgId !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('org_id', scopedOrgId);
    if (usersError || !users) return NextResponse.json({ error: usersError?.message || 'No users' }, { status: 400 });

    let { data: logs, error: logsError } = await supabase
      .from('time_logs')
      .select('*')
      .eq('org_id', scopedOrgId);
    if (logsError || !logs) logs = [];

    if (userIdParam) logs = logs.filter(l => l.user_id === userIdParam);

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const start = new Date(y, m, 1).getTime();
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
      logs = logs.filter(l => {
        const t = new Date(l.timestamp).getTime();
        return t >= start && t <= end;
      });
    }

    // simple sanitization to avoid formula injection and break lines
    const clean = (val: any) => {
      const str = (val ?? '').toString().replace(/[\r\n]+/g, ' ');
      const escaped = str.replace(/"/g, '""');
      // prefix if starts with formula control characters
      return /^[=+@-]/.test(escaped) ? `'${escaped}` : escaped;
    };

    let csv = 'Data,Ora,Dipendente,CodiceFiscale,Azione,Luogo\n';
    const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(log => {
      const userRow = users.find((u: any) => u.id === log.user_id);
      const date = clean(new Date(log.timestamp).toLocaleDateString(locale));
      const time = clean(new Date(log.timestamp).toLocaleTimeString(locale));
      const userName = clean(userRow ? userRow.name : 'Sconosciuto');
      const taxId = clean(userRow ? (userRow.tax_id || 'N/A') : 'N/A');
      const location = clean(log.location || '');
      csv += `"${date}","${time}","${userName}","${taxId}","${log.type}","${location}"\n`;
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8'
      }
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
