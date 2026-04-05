import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getLedgerCollectionsDashboard } from '@/lib/db';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const dashboard = await getLedgerCollectionsDashboard();
    return NextResponse.json(dashboard);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load ledger' }, { status: 500 });
  }
}
