import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySummaries, getSummaryWithBreakdown } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { istYmd, istWeekRangeFrom, istMonthRangeFrom } from '@/lib/ist';

function getDateRangeForSummary(
  range: string | null,
  fromParam: string | null,
  toParam: string | null
): { from: string; to: string; label: string } | null {
  const now = new Date();
  const today = istYmd(now);

  if (range === 'day') {
    return { from: today, to: today, label: 'Today' };
  }
  if (range === 'week') {
    const { from, to } = istWeekRangeFrom(now);
    return { from, to, label: 'This week' };
  }
  if (range === 'month') {
    const { from, to } = istMonthRangeFrom(now);
    return { from, to, label: 'This month' };
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
        const row = await getSummaryWithBreakdown(
          dateRange.from,
          dateRange.to,
          dateRange.label
        );
        return NextResponse.json(row);
      }
    }

    if (range === 'custom' && (!fromParam || !toParam)) {
      return NextResponse.json(
        { error: 'Custom range requires from and to dates' },
        { status: 400 }
      );
    }

    const year = searchParams.get('year');
    const summaries = await getMonthlySummaries(year ? parseInt(year, 10) : undefined);
    return NextResponse.json(summaries);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
