import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySummaries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get('year');
    const summaries = await getMonthlySummaries(year ? parseInt(year, 10) : undefined);
    return NextResponse.json(summaries);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
