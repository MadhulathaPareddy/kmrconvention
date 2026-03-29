import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  deleteLoanAccountEntry,
  getLoanAccountDashboard,
  updateLoanAccountEntry,
} from '@/lib/db';
import type { LoanAccountEntryKind } from '@/lib/types';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
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

  const entry = await updateLoanAccountEntry(id, {
    entry_kind,
    event_id: entry_kind === 'transfer_from_event' ? event_id : null,
    amount,
    note,
  });
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found or invalid update' }, { status: 404 });
  }
  const dashboard = await getLoanAccountDashboard();
  return NextResponse.json({ ok: true, entry, ...dashboard });
}

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
  const ok = await deleteLoanAccountEntry(id);
  if (!ok) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }
  const dashboard = await getLoanAccountDashboard();
  return NextResponse.json({ ok: true, ...dashboard });
}
