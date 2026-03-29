import { NextRequest, NextResponse } from 'next/server';
import { getEvents, createEvent } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { toPublicEventPayload } from '@/lib/publicEvent';

function getDateRangeForFilter(filter: string | null): { from?: string; to?: string } {
  if (!filter || filter === 'all') return {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  if (filter === 'week') {
    const start = new Date(y, m, d - dayOfWeek);
    const end = new Date(y, m, d - dayOfWeek + 6);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }
  if (filter === 'month') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }
  return {};
}

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
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const last = new Date(y, m + 1, 0);
        to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      }
      const events = await getEvents(from, to);
      return NextResponse.json(events.map(toPublicEventPayload));
    }
    let from = searchParams.get('from') ?? undefined;
    let to = searchParams.get('to') ?? undefined;
    const filter = searchParams.get('filter');
    if (!from && !to && filter) {
      const range = getDateRangeForFilter(filter);
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
