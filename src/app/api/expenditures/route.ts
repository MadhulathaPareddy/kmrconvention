import { NextRequest, NextResponse } from 'next/server';
import { getExpenditures, createExpenditure } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { INCOME_CATEGORIES } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const expenditures = await getExpenditures(from, to);
    return NextResponse.json(expenditures);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch expenditures' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { date, amount, category, description, event_id, category_other, flow_type } = body;
    const flow = flow_type === 'income' ? 'income' : 'expense';
    if (!date || amount == null || !category) {
      return NextResponse.json(
        { error: 'date, amount, and category are required' },
        { status: 400 }
      );
    }
    if (flow === 'income') {
      if (!(INCOME_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: 'Invalid income category' }, { status: 400 });
      }
      if (!description?.trim()) {
        return NextResponse.json(
          { error: 'Reason / notes are required for royalty / funds added' },
          { status: 400 }
        );
      }
      if (category === 'Other' && !category_other?.trim()) {
        return NextResponse.json(
          { error: 'Please describe the source when "Other" is selected' },
          { status: 400 }
        );
      }
    } else {
      if (!event_id && !description?.trim()) {
        return NextResponse.json(
          { error: 'Description is required when the expense is not linked to an event' },
          { status: 400 }
        );
      }
      if (category === 'Other' && !category_other?.trim()) {
        return NextResponse.json(
          { error: 'Please specify the category name when "Other" is selected' },
          { status: 400 }
        );
      }
    }
    const expenditure = await createExpenditure({
      date,
      amount: Number(amount),
      category,
      description: description?.trim() || undefined,
      event_id: flow === 'income' ? null : event_id || null,
      category_other: category === 'Other' ? (category_other?.trim() || undefined) : undefined,
      flow_type: flow,
    });
    return NextResponse.json(expenditure);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create expenditure' }, { status: 500 });
  }
}
