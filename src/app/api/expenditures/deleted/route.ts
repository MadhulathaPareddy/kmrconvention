import { NextResponse } from 'next/server';
import { getDeletedExpenditures } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rows = await getDeletedExpenditures();
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch deleted expenditures' }, { status: 500 });
  }
}
