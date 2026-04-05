import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { deleteLedgerBorrowedRepayment, getLedgerCollectionsDashboard } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  const ok = await deleteLedgerBorrowedRepayment(id);
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const dashboard = await getLedgerCollectionsDashboard();
  return NextResponse.json({ ok: true, ...dashboard });
}
