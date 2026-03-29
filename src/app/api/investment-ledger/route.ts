import { NextRequest, NextResponse } from 'next/server';
import {
  createInvestmentPartnerIn,
  createInvestmentExternalBorrowIn,
  createInvestmentExpense,
  createInvestmentPendingFromExpenseLedger,
  createInvestmentStandalonePendingBill,
  payInvestmentPendingBill,
  getInvestmentLedgerEntries,
  getInvestmentOpenPendingBills,
  getInvestmentPendingBillsInRange,
  isValidInvestmentPartner,
} from '@/lib/db';
import { isAdmin } from '@/lib/auth';

function summarize(entries: Awaited<ReturnType<typeof getInvestmentLedgerEntries>>) {
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    if (e.direction === 'in') totalIn += e.amount;
    else totalOut += e.amount;
  }
  return {
    total_in: totalIn,
    total_out: totalOut,
    net: totalIn - totalOut,
  };
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const [entries, openPending] = await Promise.all([
      getInvestmentLedgerEntries(from, to),
      getInvestmentOpenPendingBills(),
    ]);
    let pendingInRange: Awaited<ReturnType<typeof getInvestmentPendingBillsInRange>> = [];
    if (from && to) {
      pendingInRange = await getInvestmentPendingBillsInRange(from, to);
    }
    const openRemaining = openPending.reduce((s, b) => s + b.amount_remaining, 0);
    return NextResponse.json({
      entries,
      openPending,
      pendingInRange,
      summary: {
        ...summarize(entries),
        open_pending_count: openPending.length,
        open_pending_remaining: openRemaining,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load investment ledger' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'partner_in') {
      const { date, partner, amount, description } = body;
      if (!date || partner == null || amount == null) {
        return NextResponse.json({ error: 'date, partner, and amount are required' }, { status: 400 });
      }
      if (!isValidInvestmentPartner(String(partner))) {
        return NextResponse.json({ error: 'Invalid partner' }, { status: 400 });
      }
      const n = Number(amount);
      if (n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      const entry = await createInvestmentPartnerIn({
        date,
        partner,
        amount: n,
        description: description?.trim() || null,
      });
      return NextResponse.json({ ok: true, entry });
    }

    if (action === 'external_borrow') {
      const { date, external_party_name, external_details, amount } = body;
      if (!date || !external_party_name?.trim() || !external_details?.trim() || amount == null) {
        return NextResponse.json(
          { error: 'date, external_party_name, external_details, and amount are required' },
          { status: 400 }
        );
      }
      const n = Number(amount);
      if (n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      const entry = await createInvestmentExternalBorrowIn({
        date,
        external_party_name: String(external_party_name),
        external_details: String(external_details),
        amount: n,
      });
      return NextResponse.json({ ok: true, entry });
    }

    if (action === 'expense') {
      const { date, expense_type, description, amount, pending_amount } = body;
      if (!date || !expense_type?.trim() || !description?.trim() || amount == null) {
        return NextResponse.json(
          { error: 'date, expense_type, description, and amount are required' },
          { status: 400 }
        );
      }
      const n = Number(amount);
      if (n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      const p = pending_amount != null && pending_amount !== '' ? Number(pending_amount) : 0;
      if (Number.isNaN(p) || p < 0) {
        return NextResponse.json({ error: 'Invalid pending amount' }, { status: 400 });
      }
      try {
        const result = await createInvestmentExpense({
          date,
          expense_type: String(expense_type),
          description: String(description),
          amount: n,
          pending_amount: p,
        });
        return NextResponse.json({ ok: true, ...result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid expense';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (action === 'pending_from_expense') {
      const { ledger_entry_id, date_incurred, pending_amount } = body;
      if (!ledger_entry_id || pending_amount == null) {
        return NextResponse.json(
          { error: 'ledger_entry_id and pending_amount are required' },
          { status: 400 }
        );
      }
      const n = Number(pending_amount);
      if (n <= 0) return NextResponse.json({ error: 'Pending amount must be positive' }, { status: 400 });
      try {
        const bill = await createInvestmentPendingFromExpenseLedger({
          ledger_entry_id: String(ledger_entry_id),
          date_incurred: typeof date_incurred === 'string' ? date_incurred : '',
          pending_amount: n,
        });
        return NextResponse.json({ ok: true, pending_bill: bill });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create pending bill';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (action === 'pending_standalone') {
      const { date_incurred, expense_type, description, total_amount } = body;
      if (!date_incurred || !expense_type?.trim() || !description?.trim() || total_amount == null) {
        return NextResponse.json(
          { error: 'date_incurred, expense_type, description, and total_amount are required' },
          { status: 400 }
        );
      }
      const n = Number(total_amount);
      if (n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      try {
        const bill = await createInvestmentStandalonePendingBill({
          date_incurred: String(date_incurred),
          expense_type: String(expense_type),
          description: String(description),
          total_amount: n,
        });
        return NextResponse.json({ ok: true, pending_bill: bill });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create pending bill';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (action === 'pay_pending') {
      const { pending_bill_id, date, amount, paid_by, description } = body;
      if (!pending_bill_id || !date || amount == null || !paid_by?.trim() || !description?.trim()) {
        return NextResponse.json(
          { error: 'pending_bill_id, date, amount, paid_by, and description are required' },
          { status: 400 }
        );
      }
      const n = Number(amount);
      if (n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
      try {
        const result = await payInvestmentPendingBill({
          pending_bill_id: String(pending_bill_id),
          date,
          amount: n,
          paid_by: String(paid_by),
          description: String(description),
        });
        return NextResponse.json({ ok: true, ...result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Payment failed';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
  }
}
