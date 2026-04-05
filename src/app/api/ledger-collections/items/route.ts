import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  createLedgerBorrowedFund,
  createLedgerBorrowedRepayment,
  createLedgerFundsSpent,
  createLedgerPartnerInvestment,
  createLedgerPendingPayment,
  getLedgerCollectionsDashboard,
} from '@/lib/db';

type Section = 'partners' | 'borrowed' | 'spent' | 'pending' | 'repayment';

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
  const section = body.section as Section;

  try {
    if (section === 'partners') {
      const row = await createLedgerPartnerInvestment({
        partner_name: String(body.partner_name ?? ''),
        amount: Number(body.amount),
        note: typeof body.note === 'string' ? body.note : '',
        entry_date: String(body.entry_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Invalid partner investment' }, { status: 400 });
      }
    } else if (section === 'borrowed') {
      const row = await createLedgerBorrowedFund({
        party_name: String(body.party_name ?? ''),
        principal: Number(body.principal),
        details: typeof body.details === 'string' ? body.details : '',
        entry_date: String(body.entry_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Invalid borrowed fund row' }, { status: 400 });
      }
    } else if (section === 'repayment') {
      const row = await createLedgerBorrowedRepayment({
        borrowed_fund_id: String(body.borrowed_fund_id ?? ''),
        amount: Number(body.amount),
        note: typeof body.note === 'string' ? body.note : '',
        payment_date: String(body.payment_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Invalid repayment (check borrow id and amount)' }, { status: 400 });
      }
    } else if (section === 'spent') {
      const row = await createLedgerFundsSpent({
        amount: Number(body.amount),
        category: typeof body.category === 'string' ? body.category : '',
        description: typeof body.description === 'string' ? body.description : '',
        note: typeof body.note === 'string' ? body.note : '',
        spent_date: String(body.spent_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Invalid funds spent row' }, { status: 400 });
      }
    } else if (section === 'pending') {
      const row = await createLedgerPendingPayment({
        amount: Number(body.amount),
        description: typeof body.description === 'string' ? body.description : '',
        note: typeof body.note === 'string' ? body.note : '',
        incurred_date: String(body.incurred_date ?? ''),
      });
      if (!row) {
        return NextResponse.json({ error: 'Invalid pending payment' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
    }

    const dashboard = await getLedgerCollectionsDashboard();
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
