import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEvents, getEventHistoryCounts } from '@/lib/db';
import { formatINR, formatDate } from '@/lib/format';
import { isAdmin } from '@/lib/auth';
import { EventsFilterTabs } from './EventsFilterTabs';
import { ViewEventChangesButton } from './ViewEventChangesButton';

export const dynamic = 'force-dynamic';

function getDateRangeForFilter(filter: string | null): { from?: string; to?: string } {
  if (!filter || filter === 'all') return {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay();
  if (filter === 'week') {
    const start = new Date(y, m, d - dayOfWeek);
    const end = new Date(y, m, d - dayOfWeek + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (filter === 'month') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  return {};
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; filter?: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) {
    redirect('/');
  }
  const { added, filter } = await searchParams;
  const { from, to } = getDateRangeForFilter(filter ?? 'all');
  const events = await getEvents(from, to);
  const historyCounts = await getEventHistoryCounts();

  return (
    <div className="space-y-6">
      {added === '1' && (
        <div className="rounded-lg border border-seagreen bg-seagreen-light px-4 py-3 text-sm font-medium text-seagreen-dark">
          Event saved. It is now visible to all users on the Events list and Dashboard.
        </div>
      )}
      <h1 className="text-2xl font-bold text-seagreen-dark">Events</h1>
      <EventsFilterTabs currentFilter={filter ?? 'all'} />

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No events in this range.
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
                <th className="px-4 py-3 font-medium text-seagreen-dark">Decor</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Kitchen</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Diesel ₹</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Incl_Diesel</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Actions</th>
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
                  <td className="px-4 py-3 text-neutral-600">{formatINR(ev.decor_royalty)}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatINR(ev.kitchen_royalty)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {ev.diesel_type === 'KMR' || ev.diesel_type === 'GUEST'
                      ? formatINR(ev.diesel_amount > 0 ? ev.diesel_amount : 30000)
                      : '—'}
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
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/events/${ev.id}/edit`}
                        className="rounded-md border border-seagreen-light bg-seagreen px-2.5 py-1 text-xs font-medium text-white hover:bg-seagreen-dark"
                      >
                        Edit
                      </Link>
                      {(historyCounts.get(ev.id) ?? 0) > 0 ? (
                        <ViewEventChangesButton eventId={ev.id} />
                      ) : null}
                    </div>
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
