import { NextRequest, NextResponse } from 'next/server';
import { getEvents, createEvent } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const events = await getEvents(from, to);
    return NextResponse.json(events);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { date, event_type, contact_info, price, diesel_included, notes } = body;
    if (!date || !event_type || price == null) {
      return NextResponse.json(
        { error: 'date, event_type, and price are required' },
        { status: 400 }
      );
    }
    const event = await createEvent({
      date,
      event_type,
      contact_info: contact_info ?? undefined,
      price: Number(price),
      diesel_included: Boolean(diesel_included),
      notes: notes ?? undefined,
    });
    return NextResponse.json(event);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
