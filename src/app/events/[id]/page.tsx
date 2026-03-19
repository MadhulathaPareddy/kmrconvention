import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEventById } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { CommentsSection } from './CommentsSection';
import { EditEventButton } from './EditEventButton';
import { EventHistorySection } from './EventHistorySection';
import { DeleteEventButton } from './DeleteEventButton';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/events"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          ← Back to events
        </Link>
        <div className="flex gap-2">
          <EditEventButton eventId={event.id} />
          <DeleteEventButton eventId={event.id} eventTitle={`${event.event_type} — ${event.date}`} />
        </div>
      </div>

      <div className="rounded-xl border border-seagreen-light bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-seagreen-dark">
          {event.event_type} — {formatDate(event.date)}
        </h1>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(event.date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Event type</dt>
            <dd className="mt-0.5 font-medium">{event.event_type}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Contact</dt>
            <dd className="mt-0.5 text-neutral-700">{event.contact_info || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Price</dt>
            <dd className="mt-0.5 font-semibold text-green-700">
              {formatINR(event.price)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Incl_Diesel</dt>
            <dd className="mt-0.5">
              {event.diesel_type === 'KMR' ? (
                <span className="font-medium text-red-600">KMR</span>
              ) : event.diesel_type === 'GUEST' ? (
                <span className="font-medium text-green-600">GUEST</span>
              ) : (
                '—'
              )}
            </dd>
          </div>
          {event.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-neutral-500">Notes</dt>
              <dd className="mt-0.5 text-neutral-700">{event.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <EventHistorySection eventId={event.id} />

      <CommentsSection eventId={event.id} />
    </div>
  );
}
