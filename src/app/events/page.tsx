import Link from 'next/link';
import { getEvents } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const { added } = await searchParams;
  const events = await getEvents();

  return (
    <div className="space-y-6">
      {added === '1' && (
        <div className="rounded-lg border border-seagreen bg-seagreen-light px-4 py-3 text-sm font-medium text-seagreen-dark">
          Event saved. It is now visible to all users on the Events list and Dashboard.
        </div>
      )}
      <h1 className="text-2xl font-bold text-seagreen-dark">Events</h1>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No events yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                <th className="px-4 py-3 font-medium text-seagreen-dark">Date</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Event</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Contact</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Price</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Diesel</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-seagreen-light/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/events/${ev.id}`}
                      className="font-medium text-seagreen-dark hover:text-seagreen hover:underline"
                    >
                      {formatDate(ev.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{ev.event_type}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {ev.contact_info || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatINR(ev.price)}
                  </td>
                  <td className="px-4 py-3">
                    {ev.diesel_included ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
