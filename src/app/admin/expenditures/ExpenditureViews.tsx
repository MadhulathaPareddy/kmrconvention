'use client';

import { useState } from 'react';
import { formatINR, formatDate } from '@/lib/format';
import type { Expenditure, Event, ExpenditureDeletion } from '@/lib/types';
import { DeleteExpenditureButton } from './DeleteExpenditureButton';

type ListExp = Expenditure & { deleteReason?: string };

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function sumOutActive(items: ListExp[]): number {
  return items
    .filter((x) => !x.deleteReason && x.flow_type !== 'income')
    .reduce((s, x) => s + Number(x.amount), 0);
}

function sumInActive(items: ListExp[]): number {
  return items
    .filter((x) => !x.deleteReason && x.flow_type === 'income')
    .reduce((s, x) => s + Number(x.amount), 0);
}

function catLabel(ex: Expenditure): string {
  if (ex.category === 'Other' && ex.category_other) return ex.category_other;
  return ex.category;
}

function normalizeExpenditure(ex: Partial<Expenditure> | null): Expenditure | null {
  if (!ex || ex.id == null) return null;
  let dateStr = '';
  try {
    dateStr =
      ex.date != null
        ? typeof ex.date === 'string'
          ? ex.date
          : new Date(ex.date as string | number).toISOString().slice(0, 10)
        : '';
  } catch {
    dateStr = '';
  }
  const amount = typeof ex.amount === 'number' ? ex.amount : Number(ex.amount);
  return {
    id: String(ex.id),
    date: dateStr,
    amount: Number.isNaN(amount) ? 0 : amount,
    category: String(ex.category ?? ''),
    description: ex.description ?? null,
    created_at: ex.created_at != null ? String(ex.created_at) : '',
    event_id: ex.event_id != null ? String(ex.event_id) : null,
    category_other: ex.category_other != null ? String(ex.category_other) : null,
    flow_type: ex.flow_type === 'income' ? 'income' : 'expense',
  };
}

function parseDeletionRow(d: ExpenditureDeletion): ListExp | null {
  const s = d.snapshot as Record<string, unknown>;
  if (s == null || typeof s !== 'object') return null;
  let dateStr = '';
  try {
    const dv = s.date;
    dateStr =
      typeof dv === 'string'
        ? dv.slice(0, 10)
        : dv != null
          ? new Date(dv as string | number).toISOString().slice(0, 10)
          : '';
  } catch {
    return null;
  }
  if (!dateStr) return null;
  const ex = normalizeExpenditure({
    id: `deleted-row-${d.id}`,
    date: dateStr,
    amount: s.amount != null ? Number(s.amount) : 0,
    category: s.category != null ? String(s.category) : '',
    description: s.description != null ? String(s.description) : null,
    event_id: s.event_id != null ? String(s.event_id) : null,
    category_other: s.category_other != null ? String(s.category_other) : null,
    flow_type: s.flow_type === 'income' ? 'income' : 'expense',
    created_at: s.created_at != null ? String(s.created_at) : undefined,
  });
  if (!ex) return null;
  return { ...ex, deleteReason: d.reason };
}

function sortByDateDesc(items: ListExp[]): ListExp[] {
  return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function flowBadge(ex: ListExp) {
  if (ex.deleteReason) {
    return (
      <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800">
        Deleted
      </span>
    );
  }
  if (ex.flow_type === 'income') {
    return (
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Royalty
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Expense</span>
  );
}

function descriptionCell(ex: ListExp) {
  if (ex.deleteReason) {
    return (
      <div className="max-w-xs">
        <p className="text-neutral-500 line-through">{ex.description || '—'}</p>
        <p className="mt-1 text-xs font-medium text-amber-900">Removal reason: {ex.deleteReason}</p>
      </div>
    );
  }
  return <span className="text-neutral-700">{ex.description || '—'}</span>;
}

function amountClass(ex: ListExp): string {
  if (ex.deleteReason) return 'px-4 py-2 font-medium text-neutral-500 line-through';
  return ex.flow_type === 'income'
    ? 'px-4 py-2 font-medium text-green-700'
    : 'px-4 py-2 font-medium text-red-700';
}

export function ExpenditureViews({
  expenditures = [],
  events = [],
  deletions = [],
}: {
  expenditures?: Expenditure[] | null;
  events?: Event[] | null;
  deletions?: ExpenditureDeletion[] | null;
}) {
  const [view, setView] = useState<'monthly' | 'event' | 'yearly'>('monthly');

  const safeExpenditures = (Array.isArray(expenditures) ? expenditures : [])
    .map(normalizeExpenditure)
    .filter((ex): ex is Expenditure => ex != null);

  const deletionRows = (Array.isArray(deletions) ? deletions : [])
    .map(parseDeletionRow)
    .filter((x): x is ListExp => x != null);

  const allItems: ListExp[] = [
    ...safeExpenditures.map((e) => ({ ...e })),
    ...deletionRows,
  ];

  const byMonth = new Map<string, ListExp[]>();
  const byEvent = new Map<string | 'none', ListExp[]>();
  const byYear = new Map<number, ListExp[]>();
  const eventMap = new Map(
    (Array.isArray(events) ? events : [])
      .filter((e) => e != null && (e as Event).id != null)
      .map((e) => [(e as Event).id, e as Event])
  );

  for (const ex of allItems) {
    const monthKey = ex.date ? ex.date.slice(0, 7) : '';
    if (monthKey) {
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey)!.push(ex);
    }

    const eid = ex.event_id ?? 'none';
    if (!byEvent.has(eid)) byEvent.set(eid, []);
    byEvent.get(eid)!.push(ex);

    const year = ex.date ? new Date(ex.date).getFullYear() : new Date().getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(ex);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort().reverse();
  const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);

  const allOut = sumOutActive(allItems);
  const allIn = sumInActive(allItems);
  const balance = allIn - allOut;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-seagreen-light bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-seagreen-dark">Fund balance (active rows only)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Event booking revenue is on the Dashboard. Totals below exclude deleted rows; removed entries still
          appear in the tables with reason. Royalties are recorded as funds added.
        </p>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-neutral-500">Funds spent (expense)</span>
            <p className="text-lg font-semibold text-red-700">{formatINR(allOut)}</p>
          </div>
          <div>
            <span className="text-neutral-500">Funds added (royalty)</span>
            <p className="text-lg font-semibold text-green-700">{formatINR(allIn)}</p>
          </div>
          <div>
            <span className="text-neutral-500">Net (royalty − spent)</span>
            <p
              className={`text-lg font-semibold ${balance >= 0 ? 'text-green-800' : 'text-red-800'}`}
            >
              {formatINR(balance)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-seagreen-light pb-2">
        <button
          type="button"
          onClick={() => setView('monthly')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            view === 'monthly'
              ? 'bg-seagreen text-white'
              : 'bg-seagreen-light/50 text-seagreen-dark hover:bg-seagreen-light'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setView('event')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            view === 'event'
              ? 'bg-seagreen text-white'
              : 'bg-seagreen-light/50 text-seagreen-dark hover:bg-seagreen-light'
          }`}
        >
          Event-wise
        </button>
        <button
          type="button"
          onClick={() => setView('yearly')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            view === 'yearly'
              ? 'bg-seagreen text-white'
              : 'bg-seagreen-light/50 text-seagreen-dark hover:bg-seagreen-light'
          }`}
        >
          Yearly
        </button>
      </div>

      {view === 'monthly' && (
        <div className="space-y-6">
          {sortedMonths.length === 0 ? (
            <p className="py-8 text-center text-neutral-500">No transactions yet.</p>
          ) : (
            sortedMonths.map((monthKey) => {
              const items = sortByDateDesc(byMonth.get(monthKey)!);
              const outM = sumOutActive(items);
              const inM = sumInActive(items);
              const netM = inM - outM;
              return (
                <div
                  key={monthKey}
                  className="overflow-hidden rounded-xl border border-seagreen-light bg-white"
                >
                  <div className="flex flex-col gap-1 border-b border-seagreen-light bg-seagreen-light/50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-seagreen-dark">{formatMonth(monthKey)}</span>
                    <div className="text-sm">
                      <span className="text-red-700">Spent {formatINR(outM)}</span>
                      <span className="mx-2 text-neutral-400">·</span>
                      <span className="text-green-700">Royalty {formatINR(inM)}</span>
                      <span className="mx-2 text-neutral-400">·</span>
                      <span className={`font-semibold ${netM >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        Net {formatINR(netM)}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Flow</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Event</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Description</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ex) => (
                        <tr
                          key={ex.id}
                          className={`border-b border-neutral-50 last:border-0 ${ex.deleteReason ? 'bg-neutral-50/80' : ''}`}
                        >
                          <td className="px-4 py-2">{formatDate(ex.date)}</td>
                          <td className="px-4 py-2">{flowBadge(ex)}</td>
                          <td className="px-4 py-2 text-neutral-600">
                            {ex.event_id
                              ? eventMap.get(ex.event_id)
                                ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}`
                                : String(ex.event_id)
                              : '—'}
                          </td>
                          <td className="px-4 py-2">{catLabel(ex)}</td>
                          <td className="px-4 py-2 text-sm">{descriptionCell(ex)}</td>
                          <td className={amountClass(ex)}>{formatINR(ex.amount)}</td>
                          <td className="px-4 py-2">
                            {!ex.deleteReason ? <DeleteExpenditureButton id={ex.id} /> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'event' && (
        <div className="space-y-6">
          {Array.from(byEvent.entries()).length === 0 ? (
            <p className="py-8 text-center text-neutral-500">No transactions yet.</p>
          ) : (
            Array.from(byEvent.entries())
              .sort((a, b) => {
                if (a[0] === 'none') return 1;
                if (b[0] === 'none') return -1;
                const evA = eventMap.get(a[0]) as Event | undefined;
                const evB = eventMap.get(b[0]) as Event | undefined;
                const dateA = evA?.date ?? '';
                const dateB = evB?.date ?? '';
                return String(dateB).localeCompare(String(dateA));
              })
              .map(([eid, rawItems]) => {
                const items = sortByDateDesc(rawItems);
                const outM = sumOutActive(items);
                const inM = sumInActive(items);
                const netM = inM - outM;
                const label =
                  eid === 'none'
                    ? 'No event / General'
                    : eventMap.get(eid as string)
                      ? `${formatDate((eventMap.get(eid as string) as Event).date)} — ${(eventMap.get(eid as string) as Event).event_type}`
                      : String(eid);
                return (
                  <div
                    key={String(eid)}
                    className="overflow-hidden rounded-xl border border-seagreen-light bg-white"
                  >
                    <div className="flex flex-col gap-1 border-b border-seagreen-light bg-seagreen-light/50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-seagreen-dark">{label}</span>
                      <div className="text-sm">
                        <span className="text-red-700">Spent {formatINR(outM)}</span>
                        <span className="mx-2 text-neutral-400">·</span>
                        <span className="text-green-700">Royalty {formatINR(inM)}</span>
                        <span className="mx-2 text-neutral-400">·</span>
                        <span className={`font-semibold ${netM >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                          Net {formatINR(netM)}
                        </span>
                      </div>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Flow</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Description</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((ex) => (
                          <tr
                            key={ex.id}
                            className={`border-b border-neutral-50 last:border-0 ${ex.deleteReason ? 'bg-neutral-50/80' : ''}`}
                          >
                            <td className="px-4 py-2">{formatDate(ex.date)}</td>
                            <td className="px-4 py-2">{flowBadge(ex)}</td>
                            <td className="px-4 py-2">{catLabel(ex)}</td>
                            <td className="px-4 py-2 text-sm">{descriptionCell(ex)}</td>
                            <td className={amountClass(ex)}>{formatINR(ex.amount)}</td>
                            <td className="px-4 py-2">
                              {!ex.deleteReason ? <DeleteExpenditureButton id={ex.id} /> : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
          )}
        </div>
      )}

      {view === 'yearly' && (
        <div className="space-y-6">
          {sortedYears.length === 0 ? (
            <p className="py-8 text-center text-neutral-500">No transactions yet.</p>
          ) : (
            sortedYears.map((year) => {
              const items = sortByDateDesc(byYear.get(year)!);
              const outM = sumOutActive(items);
              const inM = sumInActive(items);
              const netM = inM - outM;
              return (
                <div
                  key={year}
                  className="overflow-hidden rounded-xl border border-seagreen-light bg-white"
                >
                  <div className="flex flex-col gap-1 border-b border-seagreen-light bg-seagreen-light/50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-seagreen-dark">{year}</span>
                    <div className="text-sm">
                      <span className="text-red-700">Spent {formatINR(outM)}</span>
                      <span className="mx-2 text-neutral-400">·</span>
                      <span className="text-green-700">Royalty {formatINR(inM)}</span>
                      <span className="mx-2 text-neutral-400">·</span>
                      <span className={`font-semibold ${netM >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        Net {formatINR(netM)}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Flow</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Event</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Description</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ex) => (
                        <tr
                          key={ex.id}
                          className={`border-b border-neutral-50 last:border-0 ${ex.deleteReason ? 'bg-neutral-50/80' : ''}`}
                        >
                          <td className="px-4 py-2">{formatDate(ex.date)}</td>
                          <td className="px-4 py-2">{flowBadge(ex)}</td>
                          <td className="px-4 py-2 text-neutral-600">
                            {ex.event_id
                              ? eventMap.get(ex.event_id)
                                ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}`
                                : String(ex.event_id)
                              : '—'}
                          </td>
                          <td className="px-4 py-2">{catLabel(ex)}</td>
                          <td className="px-4 py-2 text-sm">{descriptionCell(ex)}</td>
                          <td className={amountClass(ex)}>{formatINR(ex.amount)}</td>
                          <td className="px-4 py-2">
                            {!ex.deleteReason ? <DeleteExpenditureButton id={ex.id} /> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
