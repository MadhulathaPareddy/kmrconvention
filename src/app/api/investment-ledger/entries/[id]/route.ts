import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { updateInvestmentLedgerEntry } from '@/lib/db';

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
  const edit_comment = typeof body.edit_comment === 'string' ? body.edit_comment : '';
  if (!edit_comment.trim()) {
    return NextResponse.json(
      { error: 'Comment is required when editing a ledger entry' },
      { status: 400 }
    );
  }
  const date = typeof body.date === 'string' ? body.date : '';
  const amount = Number(body.amount);
  if (!date || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'date and amount are required' }, { status: 400 });
  }

  try {
    const entry = await updateInvestmentLedgerEntry(
      id,
      {
        date,
        amount,
        description: body.description as string | null | undefined,
        partner_name: body.partner_name as string | null | undefined,
        external_party_name: body.external_party_name as string | null | undefined,
        external_details: body.external_details as string | null | undefined,
        expense_type: body.expense_type as string | null | undefined,
      },
      edit_comment
    );
    if (!entry) {
      return NextResponse.json({ error: 'Ledger entry not found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
