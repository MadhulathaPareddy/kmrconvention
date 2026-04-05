import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  deleteLedgerBorrowedFund,
  deleteLedgerFundsSpent,
  deleteLedgerPartnerInvestment,
  deleteLedgerPendingPayment,
  getLedgerCollectionsDashboard,
  updateLedgerBorrowedFund,
  updateLedgerFundsSpent,
  updateLedgerPartnerInvestment,
  updateLedgerPendingPayment,
} from '@/lib/db';

type Section = 'partners' | 'borrowed' | 'spent' | 'pending';

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
  const section = body.section as Section;

  try {
    if (section === 'partners') {
      const row = await updateLedgerPartnerInvestment(id, {
        partner_name: String(body.partner_name ?? ''),
        amount: Number(body.amount),
        note: typeof body.note === 'string' ? body.note : '',
        entry_date: String(body.entry_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Update failed' }, { status: 400 });
      }
    } else if (section === 'borrowed') {
      const row = await updateLedgerBorrowedFund(id, {
        party_name: String(body.party_name ?? ''),
        principal: Number(body.principal),
        details: typeof body.details === 'string' ? body.details : '',
        entry_date: String(body.entry_date ?? ''),
      });
      if (!row) {
        return NextResponse.json(
          { error: 'Update failed (principal cannot be less than total repaid)' },
          { status: 400 }
        );
      }
    } else if (section === 'spent') {
      const row = await updateLedgerFundsSpent(id, {
        amount: Number(body.amount),
        category: typeof body.category === 'string' ? body.category : '',
        description: typeof body.description === 'string' ? body.description : '',
        note: typeof body.note === 'string' ? body.note : '',
        spent_date: String(body.spent_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Update failed' }, { status: 400 });
      }
    } else if (section === 'pending') {
      const row = await updateLedgerPendingPayment(id, {
        amount: Number(body.amount),
        description: typeof body.description === 'string' ? body.description : '',
        note: typeof body.note === 'string' ? body.note : '',
        incurred_date: String(body.incurred_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Update failed' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
    }

    const dashboard = await getLedgerCollectionsDashboard();
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
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
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') as Section | null;
  if (!section || !['partners', 'borrowed', 'spent', 'pending'].includes(section)) {
    return NextResponse.json({ error: 'Missing or invalid section' }, { status: 400 });
  }

  let ok = false;
  if (section === 'partners') ok = await deleteLedgerPartnerInvestment(id);
  else if (section === 'borrowed') ok = await deleteLedgerBorrowedFund(id);
  else if (section === 'spent') ok = await deleteLedgerFundsSpent(id);
  else if (section === 'pending') ok = await deleteLedgerPendingPayment(id);

  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const dashboard = await getLedgerCollectionsDashboard();
  return NextResponse.json({ ok: true, ...dashboard });
}
