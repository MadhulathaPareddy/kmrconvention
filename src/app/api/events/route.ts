import { NextRequest, NextResponse } from 'next/server';
import { getEvents, createEvent } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { toPublicEventPayload } from '@/lib/publicEvent';
import { istEventsFilterRange, istMonthRangeFrom } from '@/lib/ist';

export async function GET(req: NextRequest) {
  try {
    const admin = await isAdmin();
    const { searchParams } = new URL(req.url);
    if (!admin) {
      const period = searchParams.get('period');
      let from: string;
      let to: string;
      if (period === 'all') {
        from = '2000-01-01';
        to = '2100-12-31';
      } else {
        const r = istMonthRangeFrom(new Date());
        from = r.from;
        to = r.to;
      }
      const events = await getEvents(from, to);
      return NextResponse.json(events.map(toPublicEventPayload));
    }
    let from = searchParams.get('from') ?? undefined;
    let to = searchParams.get('to') ?? undefined;
    const filter = searchParams.get('filter');
    if (!from && !to && filter) {
      const range = istEventsFilterRange(filter);
      from = range.from;
      to = range.to;
    }
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
    const {
      date,
      event_type,
      contact_info,
      price,
      decor_royalty,
      kitchen_royalty,
      diesel_amount,
      diesel_type,
      diesel_included,
      notes,
    } = body;
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
      decor_royalty: decor_royalty != null ? Number(decor_royalty) : undefined,
      kitchen_royalty: kitchen_royalty != null ? Number(kitchen_royalty) : undefined,
      diesel_amount: diesel_amount != null ? Number(diesel_amount) : undefined,
      diesel_type: diesel_type === 'KMR' || diesel_type === 'GUEST' ? diesel_type : null,
      diesel_included: diesel_included === true,
      notes: notes ?? undefined,
    });
    return NextResponse.json(event);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
