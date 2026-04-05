'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatINR, formatDate } from '@/lib/format';
import { istCalendarParts, istMonthLabelLong, istRangeForYm } from '@/lib/ist';
import type { MonthlySummary, SummaryWithBreakdown } from '@/lib/types';

const IST_TZ = 'Asia/Kolkata';

function formatMonthShort(ym: string): string {
  const mo = parseInt(ym.slice(5, 7), 10);
  const y = parseInt(ym.slice(0, 4), 10);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    timeZone: IST_TZ,
  }).format(new Date(y, mo - 1, 1));
}

function groupMonthsByYear(rows: MonthlySummary[]): Map<number, MonthlySummary[]> {
  const m = new Map<number, MonthlySummary[]>();
  for (const row of rows) {
    const y = row.year ?? parseInt(row.month.slice(0, 4), 10);
    const list = m.get(y) ?? [];
    list.push(row);
    m.set(y, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => b.month.localeCompare(a.month));
  }
  return m;
}

function EventBreakdownTable({ data }: { data: SummaryWithBreakdown }) {
  return (
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
  );
}

type AdvRange = 'day' | 'week' | 'month' | 'alltime' | 'custom';

export function SummaryClient() {
  const [monthlyRows, setMonthlyRows] = useState<MonthlySummary[]>([]);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [monthsError, setMonthsError] = useState('');

  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<SummaryWithBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');

  const [advOpen, setAdvOpen] = useState(false);
  const [advRange, setAdvRange] = useState<AdvRange>('alltime');
  const [advFrom, setAdvFrom] = useState('');
  const [advTo, setAdvTo] = useState('');
  const [advData, setAdvData] = useState<SummaryWithBreakdown | null>(null);
  const [advLoading, setAdvLoading] = useState(false);
  const [advError, setAdvError] = useState('');

  const byYear = useMemo(() => groupMonthsByYear(monthlyRows), [monthlyRows]);
  const yearsSorted = useMemo(
    () => Array.from(byYear.keys()).sort((a, b) => b - a),
    [byYear]
  );

  useEffect(() => {
    let cancelled = false;
    setMonthsLoading(true);
    setMonthsError('');
    fetch('/api/summary')
      .then((res) => {
        if (res.status === 401) throw new Error('Unauthorized');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setMonthsError(json.error);
          setMonthlyRows([]);
          return;
        }
        if (Array.isArray(json)) {
          setMonthlyRows(json as MonthlySummary[]);
        } else {
          setMonthlyRows([]);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setMonthsError(e.message || 'Failed to load');
          setMonthlyRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMonthsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMonth) {
      setBreakdown(null);
      setBreakdownError('');
      return;
    }
    let cancelled = false;
    setBreakdownLoading(true);
    setBreakdownError('');
    const q = new URLSearchParams({
      range: 'calendar_month',
      ym: selectedMonth,
    });
    fetch(`/api/summary?${q}`)
      .then((res) => {
        if (res.status === 401) throw new Error('Unauthorized');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setBreakdownError(json.error);
          setBreakdown(null);
          return;
        }
        if (json.period_label != null) {
          const row = json as SummaryWithBreakdown;
          setBreakdown({
            ...row,
            event_lines: Array.isArray(row.event_lines) ? row.event_lines : [],
            unlinked_expenditure:
              typeof row.unlinked_expenditure === 'number' ? row.unlinked_expenditure : 0,
          });
        } else {
          setBreakdown(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setBreakdownError(e.message || 'Failed to load');
          setBreakdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const loadAdvanced = useCallback(() => {
    if (advRange === 'custom' && (!advFrom || !advTo)) {
      setAdvData(null);
      setAdvError('');
      setAdvLoading(false);
      return;
    }
    setAdvLoading(true);
    setAdvError('');
    const params = new URLSearchParams();
    params.set('range', advRange);
    if (advRange === 'custom' && advFrom && advTo) {
      params.set('from', advFrom);
      params.set('to', advTo);
    }
    fetch(`/api/summary?${params}`)
      .then((res) => {
        if (res.status === 401) throw new Error('Unauthorized');
        return res.json();
      })
      .then((json) => {
        if (json.error) {
          setAdvError(json.error);
          setAdvData(null);
          return;
        }
        if (json.period_label != null) {
          const row = json as SummaryWithBreakdown;
          setAdvData({
            ...row,
            event_lines: Array.isArray(row.event_lines) ? row.event_lines : [],
            unlinked_expenditure:
              typeof row.unlinked_expenditure === 'number' ? row.unlinked_expenditure : 0,
          });
        } else {
          setAdvData(null);
        }
      })
      .catch((e) => {
        setAdvError(e.message || 'Failed to load');
        setAdvData(null);
      })
      .finally(() => setAdvLoading(false));
  }, [advRange, advFrom, advTo]);

  useEffect(() => {
    if (!advOpen) return;
    loadAdvanced();
  }, [advOpen, advRange, advFrom, advTo, loadAdvanced]);

  function toggleYear(year: number) {
    setExpandedYear((y) => (y === year ? null : year));
  }

  function onSelectMonth(ym: string) {
    setSelectedMonth(ym);
    const y = parseInt(ym.slice(0, 4), 10);
    setExpandedYear(y);
  }

  function jumpToCurrentMonth() {
    const { year, month } = istCalendarParts();
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    onSelectMonth(ym);
  }

  const currentYm = (() => {
    const { year, month } = istCalendarParts();
    return `${year}-${String(month).padStart(2, '0')}`;
  })();

  const selectedBounds = selectedMonth ? istRangeForYm(selectedMonth) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-seagreen-dark">Summary</h1>
      <p className="text-neutral-600">
        Pick a <strong>year</strong>, open it to see <strong>months</strong>, then choose a month to
        see every <strong>booking</strong> with revenue, linked expenses, and profit (same columns as
        before). Figures use event date and expenditure line dates in IST.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={jumpToCurrentMonth}
          className="rounded-md bg-seagreen px-3 py-1.5 text-sm font-medium text-white hover:bg-seagreen-dark"
        >
          Jump to this month ({istMonthLabelLong(currentYm)})
        </button>
      </div>

      {monthsError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {monthsError}
        </p>
      )}

      {monthsLoading && <p className="text-neutral-500">Loading years…</p>}

      {!monthsLoading && !monthsError && yearsSorted.length === 0 && (
        <p className="rounded-xl border border-dashed border-seagreen-light bg-seagreen-light/30 py-10 text-center text-neutral-600">
          No activity yet — add events or expenditures to see months here.
        </p>
      )}

      {!monthsLoading && yearsSorted.length > 0 && (
        <div className="space-y-2">
          {yearsSorted.map((year) => {
            const months = byYear.get(year) ?? [];
            const open = expandedYear === year;
            return (
              <div
                key={year}
                className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleYear(year)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-seagreen-light/30"
                >
                  <span className="text-lg font-semibold text-seagreen-dark">{year}</span>
                  <span className="text-neutral-500">{open ? '▼' : '▶'}</span>
                </button>
                {open && (
                  <div className="border-t border-seagreen-light/50 bg-neutral-50/80 px-3 py-3">
                    <p className="mb-2 text-xs font-medium text-neutral-500">
                      Select a month for event-level detail
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {months.map((row) => {
                        const active = selectedMonth === row.month;
                        return (
                          <button
                            key={row.month}
                            type="button"
                            onClick={() => onSelectMonth(row.month)}
                            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                              active
                                ? 'border-seagreen bg-seagreen/10 ring-2 ring-seagreen/40'
                                : 'border-neutral-200 bg-white hover:border-seagreen-light'
                            }`}
                          >
                            <div className="font-semibold text-seagreen-dark">
                              {formatMonthShort(row.month)} {year}
                            </div>
                            <div className="mt-1 text-xs text-neutral-600">
                              {row.event_count} event{row.event_count === 1 ? '' : 's'} ·{' '}
                              <span className="text-green-700">{formatINR(row.revenue)}</span>
                              {' / '}
                              <span className="text-red-700">{formatINR(row.expenditure)}</span>
                            </div>
                            <div className="mt-0.5 text-xs font-medium text-seagreen-dark">
                              Profit {formatINR(row.profit)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedMonth && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-seagreen-dark">
              {istMonthLabelLong(selectedMonth)}
              {selectedBounds ? (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  ({selectedBounds.from} → {selectedBounds.to})
                </span>
              ) : null}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="text-sm font-medium text-seagreen-dark hover:text-seagreen hover:underline"
            >
              Clear month selection
            </button>
          </div>
          {breakdownError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {breakdownError}
            </p>
          )}
          {breakdownLoading && <p className="text-neutral-500">Loading events…</p>}
          {!breakdownLoading && breakdown && <EventBreakdownTable data={breakdown} />}
        </div>
      )}

      <details
        className="rounded-xl border border-neutral-200 bg-white shadow-sm"
        open={advOpen}
        onToggle={(e) => setAdvOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
          Other ranges (day, week, rolling month, all time, custom)
        </summary>
        <div className="space-y-4 border-t border-neutral-100 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['day', 'week', 'month', 'alltime'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setAdvRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  advRange === r
                    ? 'bg-seagreen text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {r === 'day'
                  ? 'Day'
                  : r === 'week'
                    ? 'Week'
                    : r === 'month'
                      ? 'This month'
                      : 'All time'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAdvRange('custom')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                advRange === 'custom'
                  ? 'bg-seagreen text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Custom range
            </button>
            {advRange === 'custom' && (
              <span className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={advFrom}
                  onChange={(e) => setAdvFrom(e.target.value)}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
                />
                <span className="text-neutral-500">to</span>
                <input
                  type="date"
                  value={advTo}
                  onChange={(e) => setAdvTo(e.target.value)}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
                />
              </span>
            )}
          </div>
          {advError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {advError}
            </p>
          )}
          {advLoading && <p className="text-neutral-500">Loading…</p>}
          {advRange === 'custom' && (!advFrom || !advTo) && !advLoading && (
            <p className="text-sm text-neutral-500">Choose From and To dates.</p>
          )}
          {!advLoading && advData && <EventBreakdownTable data={advData} />}
        </div>
      </details>
    </div>
  );
}
