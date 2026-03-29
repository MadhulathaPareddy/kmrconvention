import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  createLoanAccountEntry,
  getLoanAccountDashboard,
} from '@/lib/db';
import type { LoanAccountEntryKind } from '@/lib/types';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const dashboard = await getLoanAccountDashboard();
    return NextResponse.json(dashboard);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const rawKind = String(body.entry_kind ?? '');
  const entry_kind: LoanAccountEntryKind =
    rawKind === 'emi_payment' ? 'emi_payment' : 'transfer_from_event';
  const amount = Number(body.amount);
  const note = typeof body.note === 'string' ? body.note : '';
  const event_id =
    body.event_id != null && body.event_id !== '' ? String(body.event_id) : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
  }
  if (entry_kind === 'transfer_from_event' && !event_id?.trim()) {
    return NextResponse.json({ error: 'Event is required for a transfer from an event' }, { status: 400 });
  }

  try {
    const entry = await createLoanAccountEntry({
      entry_kind,
      event_id: entry_kind === 'transfer_from_event' ? event_id : null,
      amount,
      note,
    });
    if (!entry) {
      return NextResponse.json(
        { error: 'Could not create entry (check event and amount)' },
        { status: 400 }
      );
    }
    const dashboard = await getLoanAccountDashboard();
    return NextResponse.json({ ok: true, entry, ...dashboard });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
