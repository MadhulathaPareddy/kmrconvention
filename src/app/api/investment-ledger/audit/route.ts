import { NextRequest, NextResponse } from 'next/server';
import { getInvestmentAuditLog } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const refType = searchParams.get('refType');
    const refId = searchParams.get('refId');
    if (!refType || !refId) {
      return NextResponse.json({ error: 'refType and refId are required' }, { status: 400 });
    }
    const rows = await getInvestmentAuditLog(refType, refId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
