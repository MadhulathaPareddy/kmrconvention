'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR, formatDate } from '@/lib/format';
import type { SummaryWithBreakdown } from '@/lib/types';

type RangeType = 'day' | 'week' | 'month' | 'custom' | 'alltime';

export function SummaryClient() {
  const [range, setRange] = useState<RangeType>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SummaryWithBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Hall summary: loading/error/data tied to fetch — rule flags intentional sync updates. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    if (range === 'custom' && (!from || !to)) {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setLoading(false);
          setData(null);
          setError('');
        }
      });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('range', range);
    if (range === 'custom' && from && to) {
      params.set('from', from);
      params.set('to', to);
    }
    fetch(`/api/summary?${params}`)
      .then((res) => {
        if (res.status === 401) throw new Error('Unauthorized');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          setData(null);
        } else if (json.period_label != null) {
          const row = json as SummaryWithBreakdown;
          setData({
            ...row,
            event_lines: Array.isArray(row.event_lines) ? row.event_lines : [],
            unlinked_expenditure:
              typeof row.unlinked_expenditure === 'number' ? row.unlinked_expenditure : 0,
          });
        } else {
          setData(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || 'Failed to load summary');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, from, to]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-seagreen-dark">Summary</h1>
      <p className="text-neutral-600">
        Event count, revenue (booking prices plus any <strong>tag-linked</strong> royalty from Expenditures,
        counted in the month of that royalty line), and recorded expenses. Profit is revenue minus
        expenses. Rows below list each <strong>booking</strong> in the period (by event date); revenue per
        row matches the event page (price + decor + kitchen + royalties dated in this range). The last row
        is the same hall-wide total as before.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-b border-seagreen-light pb-4">
        {(['day', 'week', 'month', 'alltime'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              range === r
                ? 'bg-seagreen text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {r === 'day' ? 'Day' : r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All time'}
          </button>
        ))}
        <span className="text-neutral-400">|</span>
        <button
          type="button"
          onClick={() => setRange('custom')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            range === 'custom'
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Custom range
        </button>
        {range === 'custom' && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="text-neutral-500">Loading…</p>}

      {!loading && data && (
        <div className="overflow-x-auto rounded-xl border border-seagreen-light bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                <th className="px-4 py-3 font-medium text-seagreen-dark">Date</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Event</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Contact</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Revenue</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Expenses (linked)</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.event_lines.length === 0 && (data.unlinked_expenditure ?? 0) <= 0 ? (
                <tr className="border-b border-neutral-100">
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    No events dated in this period.
                  </td>
                </tr>
              ) : (
                <>
                  {data.event_lines.map((line) => (
                    <tr
                      key={line.event_id}
                      className="border-b border-neutral-100 hover:bg-seagreen-light/20"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${line.event_id}`}
                          className="font-medium text-seagreen-dark hover:text-seagreen hover:underline"
                        >
                          {formatDate(line.date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{line.event_type}</td>
                      <td className="px-4 py-3 text-neutral-600">{line.contact_info || '—'}</td>
                      <td className="px-4 py-3 text-green-700">{formatINR(line.revenue)}</td>
                      <td className="px-4 py-3 text-red-700">{formatINR(line.expenditure)}</td>
                      <td className="px-4 py-3 font-medium text-seagreen-dark">
                        {formatINR(line.profit)}
                      </td>
                    </tr>
                  ))}
                  {(data.unlinked_expenditure ?? 0) > 0 ? (
                    <tr className="border-b border-neutral-100 bg-neutral-50/80">
                      <td className="px-4 py-3 text-neutral-500">—</td>
                      <td className="px-4 py-3 font-medium text-neutral-700" colSpan={2}>
                        General / not linked to a booking
                      </td>
                      <td className="px-4 py-3 text-neutral-400">—</td>
                      <td className="px-4 py-3 text-red-700">
                        {formatINR(data.unlinked_expenditure)}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-800">
                        {formatINR(-data.unlinked_expenditure)}
                      </td>
                    </tr>
                  ) : null}
                </>
              )}
              <tr className="bg-seagreen-light/40 font-semibold">
                <td className="px-4 py-3 text-seagreen-dark" colSpan={3}>
                  Total · {data.period_label}
                </td>
                <td className="px-4 py-3 text-green-800">{formatINR(data.revenue)}</td>
                <td className="px-4 py-3 text-red-800">{formatINR(data.expenditure)}</td>
                <td className="px-4 py-3 text-seagreen-dark">{formatINR(data.profit)}</td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-seagreen-light/50 px-4 py-2 text-xs text-neutral-500">
            Total <strong>events</strong> in period (bookings): {data.event_count}. Hall-wide revenue /
            expenses match tagged royalty and all expense lines in the date range (including unlinked).
          </p>
        </div>
      )}

      {!loading && !data && !error && range !== 'custom' && (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No data for this period.
        </p>
      )}

      {range === 'custom' && !loading && !data && !error && (!from || !to) && (
        <p className="text-neutral-500">Choose From and To dates to load the summary.</p>
      )}
    </div>
  );
}
