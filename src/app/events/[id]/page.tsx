import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEventById } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { CommentsSection } from './CommentsSection';

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
      <Link
        href="/events"
        className="text-sm font-medium text-amber-700 hover:text-amber-600"
      >
        ← Back to events
      </Link>

      <div className="rounded-xl border border-amber-200/60 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-amber-900">
          {event.event_type} — {formatDate(event.date)}
        </h1>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-stone-500">Date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(event.date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-stone-500">Event type</dt>
            <dd className="mt-0.5 font-medium">{event.event_type}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-stone-500">Contact</dt>
            <dd className="mt-0.5 text-stone-700">{event.contact_info || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-stone-500">Price</dt>
            <dd className="mt-0.5 font-semibold text-green-700">
              {formatINR(event.price)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-stone-500">Diesel included</dt>
            <dd className="mt-0.5">{event.diesel_included ? 'Yes' : 'No'}</dd>
          </div>
          {event.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-stone-500">Notes</dt>
              <dd className="mt-0.5 text-stone-700">{event.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <CommentsSection eventId={event.id} />
    </div>
  );
}
