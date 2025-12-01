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

    // Authorization
    if (user.role !== 'ADMIN') {
      if (userIdParam && userIdParam !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (orgIdParam && orgIdParam !== user.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (usersError || !users) return NextResponse.json({ error: usersError?.message || 'No users' }, { status: 400 });

    let { data: logs, error: logsError } = await supabase.from('time_logs').select('*');
    if (logsError || !logs) logs = [];

    if (userIdParam) logs = logs.filter(l => l.user_id === userIdParam);
    if (orgIdParam) logs = logs.filter(l => l.org_id === orgIdParam);

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

    let csv = 'Data,Ora,Dipendente,CodiceFiscale,Azione,Luogo\n';
    const locale = language === 'EN' ? 'en-US' : language.toLowerCase();
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(log => {
      const userRow = users.find((u: any) => u.id === log.user_id);
      const date = new Date(log.timestamp).toLocaleDateString(locale);
      const time = new Date(log.timestamp).toLocaleTimeString(locale);
      const userName = userRow ? userRow.name : 'Sconosciuto';
      const taxId = userRow ? (userRow.tax_id || 'N/A') : 'N/A';
      const location = log.location || '';
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
