import Link from 'next/link';
import { getMonthlySummaries, getEvents } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [summaries, events] = await Promise.all([
    getMonthlySummaries(new Date().getFullYear()),
    getEvents(),
  ]);
  const recentEvents = events.slice(0, 5);
  const currentMonth = summaries[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-amber-900">Dashboard</h1>
        <p className="mt-1 text-stone-600">
          KMR Convention Hall — Hyderabad
        </p>
      </div>

      {currentMonth && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-200/60 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Events this month</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {currentMonth.event_count}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/60 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Monthly revenue</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {formatINR(currentMonth.revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/60 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Monthly expenditure</p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {formatINR(currentMonth.expenditure)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/60 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Profit</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">
              {formatINR(currentMonth.profit)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-900">Recent events</h2>
        <Link
          href="/events"
          className="text-sm font-medium text-amber-700 hover:text-amber-600"
        >
          View all →
        </Link>
      </div>

      {recentEvents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-12 text-center text-stone-500">
          No events yet. Add events as admin to see them here.
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
              {recentEvents.map((ev) => (
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

      <div className="flex justify-end">
        <Link
          href="/summary"
          className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
        >
          Monthly summary →
        </Link>
      </div>
    </div>
  );
}
