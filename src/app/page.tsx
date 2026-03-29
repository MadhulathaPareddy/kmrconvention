import Link from 'next/link';
import { getMonthlySummaries, getEvents } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { istYmd, istMonthRangeFrom, istYear, istCalendarParts } from '@/lib/ist';
import { isAdmin } from '@/lib/auth';
import type { Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

function isUpcomingEvent(ev: Event, todayYmd: string): boolean {
  return ev.date >= todayYmd;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const admin = await isAdmin();
  const sp = await searchParams;

  if (admin) {
    const [summaries, events] = await Promise.all([
      getMonthlySummaries(istYear()),
      getEvents(),
    ]);
    const recentEvents = events.slice(0, 5);
    const { year: dashY, month: dashMo } = istCalendarParts(new Date());
    const ym = `${dashY}-${String(dashMo).padStart(2, '0')}`;
    const currentMonth =
      summaries.find((s) => s.month === ym) ?? {
        month: ym,
        year: dashY,
        event_count: 0,
        revenue: 0,
        expenditure: 0,
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">Events this month</p>
            <p className="mt-1 text-2xl font-bold text-seagreen-dark">
              {currentMonth.event_count}
            </p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">Revenue</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {formatINR(currentMonth.revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">Expenses (spent)</p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {formatINR(currentMonth.expenditure)}
            </p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">Profit (revenue − expenses)</p>
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

        <div className="flex justify-end">
          <Link
            href="/summary"
            className="rounded-lg bg-seagreen-light px-4 py-2 text-sm font-medium text-seagreen-dark hover:bg-seagreen-light/80"
          >
            Summary →
          </Link>
        </div>
      </div>
    );
  }

  const todayYmd = istYmd();
  const showAll = sp?.period === 'all';
  const { from, to } = showAll
    ? { from: '2000-01-01', to: '2100-12-31' }
    : istMonthRangeFrom(new Date());
  const publicEvents = await getEvents(from, to);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-seagreen-dark">Dashboard</h1>
        <p className="mt-1 text-neutral-600">
          KMR Convention Hall — Hyderabad
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Events for the selected range. Orange = upcoming (today or later); green = completed (past
          dates). No prices are shown here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-seagreen-light pb-3">
        <span className="text-sm font-medium text-neutral-600">Show:</span>
        <Link
          href="/?period=month"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen-dark focus-visible:ring-offset-2 ${
            !showAll
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
          aria-current={!showAll ? 'page' : undefined}
        >
          This month
        </Link>
        <Link
          href="/?period=all"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen-dark focus-visible:ring-offset-2 ${
            showAll
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
          aria-current={showAll ? 'page' : undefined}
        >
          All events
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-seagreen-dark">
          {showAll ? 'All events' : 'Events this month'}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {!showAll
            ? `${formatDate(from)} — ${formatDate(to)} · sorted by date`
            : 'Every scheduled event, oldest to newest'}
        </p>
        {publicEvents.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
            {showAll ? 'No events on file.' : 'No events in the current calendar month.'}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                  <th className="px-4 py-3 font-medium text-seagreen-dark">Status</th>
                  <th className="px-4 py-3 font-medium text-seagreen-dark">Date</th>
                  <th className="px-4 py-3 font-medium text-seagreen-dark">Event</th>
                  <th className="px-4 py-3 font-medium text-seagreen-dark">Contact</th>
                  <th className="px-4 py-3 font-medium text-seagreen-dark">Incl_Diesel</th>
                </tr>
              </thead>
              <tbody>
                {publicEvents.map((ev) => {
                  const upcoming = isUpcomingEvent(ev, todayYmd);
                  return (
                    <tr
                      key={ev.id}
                      className={`border-b border-neutral-100 last:border-0 ${
                        upcoming
                          ? 'bg-orange-50/90 hover:bg-orange-100/90'
                          : 'bg-green-50/90 hover:bg-green-100/90'
                      }`}
                    >
                      <td className="px-4 py-3">
                        {upcoming ? (
                          <span className="inline-flex rounded-full bg-orange-200 px-2.5 py-0.5 text-xs font-semibold text-orange-900">
                            Upcoming
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-900">
                            Completed
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          upcoming ? 'text-orange-950' : 'text-green-950'
                        }`}
                      >
                        {formatDate(ev.date)}
                      </td>
                      <td
                        className={`px-4 py-3 ${upcoming ? 'text-orange-950' : 'text-green-950'}`}
                      >
                        {ev.event_type}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {ev.contact_info || '—'}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
