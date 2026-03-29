import Link from 'next/link';
import { getMonthlySummaries, getEvents } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [summaries, events, admin] = await Promise.all([
    getMonthlySummaries(new Date().getFullYear()),
    getEvents(),
    isAdmin(),
  ]);
  const recentEvents = events.slice(0, 5);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth =
    summaries.find((s) => s.month === ym) ?? {
      month: ym,
      year: now.getFullYear(),
      event_count: 0,
      revenue: 0,
      expenditure: 0,
      fund_inflow: 0,
      fund_net: 0,
      profit: 0,
    };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-seagreen-dark">Dashboard</h1>
        <p className="mt-1 text-neutral-600">
          KMR Convention Hall — Hyderabad
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Events this month</p>
          <p className="mt-1 text-2xl font-bold text-seagreen-dark">
            {currentMonth.event_count}
          </p>
        </div>
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Event revenue (bookings)</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {formatINR(currentMonth.revenue)}
          </p>
        </div>
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Funds added (royalty / investment)</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {formatINR(currentMonth.fund_inflow)}
          </p>
        </div>
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Funds out (expenses)</p>
          <p className="mt-1 text-2xl font-bold text-red-700">
            {formatINR(currentMonth.expenditure)}
          </p>
        </div>
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Fund net (ledger)</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              currentMonth.fund_net >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {formatINR(currentMonth.fund_net)}
          </p>
        </div>
        <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Profit (bookings − funds out)</p>
          <p className="mt-1 text-2xl font-bold text-seagreen-dark">
            {formatINR(currentMonth.profit)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-seagreen-dark">Recent events</h2>
        <Link
          href="/events"
          className="text-sm font-medium text-seagreen-dark hover:text-seagreen"
        >
          View all →
        </Link>
      </div>

      {recentEvents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No events yet. Add events as admin to see them here.
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
                <th className="px-4 py-3 font-medium text-seagreen-dark">Incl_Diesel</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((ev) => (
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
                    {ev.diesel_type === 'KMR' ? (
                      <span className="font-medium text-red-600">KMR</span>
                    ) : ev.diesel_type === 'GUEST' ? (
                      <span className="font-medium text-green-600">GUEST</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {admin && (
        <div className="flex justify-end">
          <Link
            href="/summary"
            className="rounded-lg bg-seagreen-light px-4 py-2 text-sm font-medium text-seagreen-dark hover:bg-seagreen-light/80"
          >
            Monthly summary →
          </Link>
        </div>
      )}
    </div>
  );
}
