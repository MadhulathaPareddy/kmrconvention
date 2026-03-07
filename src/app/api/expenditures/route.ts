import { NextRequest, NextResponse } from 'next/server';
import { getExpenditures, createExpenditure } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

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
    const { date, amount, category, description } = body;
    if (!date || amount == null || !category) {
      return NextResponse.json(
        { error: 'date, amount, and category are required' },
        { status: 400 }
      );
    }
    const expenditure = await createExpenditure({
      date,
      amount: Number(amount),
      category,
      description: description ?? undefined,
    });
    return NextResponse.json(expenditure);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create expenditure' }, { status: 500 });
  }
}
