import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySummaries, getSummaryByRange } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

function getDateRangeForSummary(
  range: string | null,
  fromParam: string | null,
  toParam: string | null
): { from: string; to: string; label: string } | null {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay();

  if (range === 'day') {
    return { from: today, to: today, label: 'Today' };
  }
  if (range === 'week') {
    const start = new Date(y, m, d - dayOfWeek);
    const end = new Date(y, m, d - dayOfWeek + 6);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      label: 'This week',
    };
  }
  if (range === 'month') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      label: 'This month',
    };
  }
  if (range === 'custom' && fromParam && toParam) {
    return {
      from: fromParam,
      to: toParam,
      label: `Custom (${fromParam} to ${toParam})`,
    };
  }
  if (range === 'alltime') {
    return {
      from: '2000-01-01',
      to: today,
      label: 'All time',
    };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (range && range !== 'year') {
      const dateRange = getDateRangeForSummary(range, fromParam, toParam);
      if (dateRange) {
        const row = await getSummaryByRange(
          dateRange.from,
          dateRange.to,
          dateRange.label
        );
        return NextResponse.json(row);
      }
    }

    const year = searchParams.get('year');
    const summaries = await getMonthlySummaries(year ? parseInt(year, 10) : undefined);
    return NextResponse.json(summaries);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
