import { NextRequest, NextResponse } from 'next/server';
import { getEventHistory } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const history = await getEventHistory(id);
    return NextResponse.json(history);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
