import Link from 'next/link';
import { getEvents } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-amber-900">Events</h1>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-12 text-center text-stone-500">
          No events yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50/50">
                <th className="px-4 py-3 font-medium text-amber-900">Date</th>
                <th className="px-4 py-3 font-medium text-amber-900">Event</th>
                <th className="px-4 py-3 font-medium text-amber-900">Contact</th>
                <th className="px-4 py-3 font-medium text-amber-900">Price</th>
                <th className="px-4 py-3 font-medium text-amber-900">Diesel</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-amber-50/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/events/${ev.id}`}
                      className="font-medium text-amber-800 hover:underline"
                    >
                      {formatDate(ev.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{ev.event_type}</td>
                  <td className="px-4 py-3 text-stone-600">
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
