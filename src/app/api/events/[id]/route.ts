import { NextRequest, NextResponse } from 'next/server';
import { getEventById, updateEvent, deleteEvent } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { toPublicEventPayload } from '@/lib/publicEvent';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin();
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!admin) {
      const today = new Date().toISOString().slice(0, 10);
      if (event.date < today) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(toPublicEventPayload(event));
    }
    return NextResponse.json(event);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const changeComment =
      typeof body.change_comment === 'string' ? body.change_comment.trim() : '';
    if (!changeComment) {
      return NextResponse.json(
        { error: 'A short comment explaining this change is required' },
        { status: 400 }
      );
    }
    const event = await updateEvent(id, changeComment, {
      date: body.date,
      event_type: body.event_type,
      contact_info: body.contact_info,
      price: body.price != null ? Number(body.price) : undefined,
      decor_royalty: body.decor_royalty != null ? Number(body.decor_royalty) : undefined,
      kitchen_royalty: body.kitchen_royalty != null ? Number(body.kitchen_royalty) : undefined,
      diesel_amount: body.diesel_amount != null ? Number(body.diesel_amount) : undefined,
      diesel_type: body.diesel_type === 'KMR' || body.diesel_type === 'GUEST' ? body.diesel_type : body.diesel_type === null ? null : undefined,
      diesel_included: body.diesel_included,
      notes: body.notes,
    });
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message === 'A short comment explaining this change is required') {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json(
        { error: 'Reason for deletion is required' },
        { status: 400 }
      );
    }
    const ok = await deleteEvent(id, reason);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
