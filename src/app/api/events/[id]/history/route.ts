import { NextRequest, NextResponse } from 'next/server';
import { getEventHistory } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await getEventHistory(id);
    return NextResponse.json(history);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
