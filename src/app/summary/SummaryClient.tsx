'use client';

import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';
import type { SummaryRow } from '@/lib/types';

type RangeType = 'day' | 'week' | 'month' | 'custom' | 'alltime';

export function SummaryClient() {
  const [range, setRange] = useState<RangeType>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
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
          setData(json as SummaryRow);
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
    return () => { cancelled = true; };
  }, [range, range === 'custom' ? from : '', range === 'custom' ? to : '']);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-seagreen-dark">Summary</h1>
      <p className="text-neutral-600">
        Event count, revenue (booking prices plus any <strong>tag-linked</strong> royalty from Expenditures,
        counted in the month of that royalty line), and recorded expenses. Profit is revenue minus
        expenses.
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
          <span className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => {}}
              aria-label="Apply custom range"
              className="rounded-md bg-seagreen px-3 py-1 text-sm text-white hover:bg-seagreen-dark"
            >
              Apply
            </button>
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
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                <th className="px-4 py-3 font-medium text-seagreen-dark">Period</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Events</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Revenue</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Expenses</th>
                <th className="px-4 py-3 font-medium text-seagreen-dark">Profit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100 hover:bg-seagreen-light/30">
                <td className="px-4 py-3 font-medium">{data.period_label}</td>
                <td className="px-4 py-3">{data.event_count}</td>
                <td className="px-4 py-3 text-green-700">{formatINR(data.revenue)}</td>
                <td className="px-4 py-3 text-red-700">{formatINR(data.expenditure)}</td>
                <td className="px-4 py-3 font-medium text-seagreen-dark">
                  {formatINR(data.profit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && !data && !error && range !== 'custom' && (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/50 py-12 text-center text-neutral-500">
          No data for this period.
        </p>
      )}

      {range === 'custom' && !loading && !data && !error && (
        <p className="text-neutral-500">Select From and To dates and click Apply.</p>
      )}
    </div>
  );
}
