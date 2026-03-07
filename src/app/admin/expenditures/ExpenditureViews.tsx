'use client';

import { useState } from 'react';
import { formatINR, formatDate } from '@/lib/format';
import type { Expenditure } from '@/lib/types';
import type { Event } from '@/lib/types';
import { DeleteExpenditureButton } from './DeleteExpenditureButton';

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function normalizeExpenditure(ex: Partial<Expenditure> | null): Expenditure | null {
  if (!ex || ex.id == null) return null;
  let dateStr = '';
  try {
    dateStr = ex.date != null
      ? (typeof ex.date === 'string' ? ex.date : new Date(ex.date as string | number).toISOString().slice(0, 10))
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
  };
}

export function ExpenditureViews({
  expenditures = [],
  events = [],
}: {
  expenditures?: Expenditure[] | null;
  events?: Event[] | null;
}) {
  const [view, setView] = useState<'monthly' | 'event' | 'yearly'>('monthly');

  const safeExpenditures = (Array.isArray(expenditures) ? expenditures : [])
    .map(normalizeExpenditure)
    .filter((ex): ex is Expenditure => ex != null);

  const byMonth = new Map<string, Expenditure[]>();
  const byEvent = new Map<string | 'none', Expenditure[]>();
  const byYear = new Map<number, Expenditure[]>();
  const eventMap = new Map(
    (Array.isArray(events) ? events : [])
      .filter((e) => e != null && (e as Event).id != null)
      .map((e) => [(e as Event).id, e as Event])
  );

  for (const ex of safeExpenditures) {
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

  return (
    <div className="space-y-4">
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
            <p className="py-8 text-center text-neutral-500">No expenditures.</p>
          ) : (
            sortedMonths.map((monthKey) => {
              const items = byMonth.get(monthKey)!;
              const total = items.reduce((s, x) => s + Number(x.amount), 0);
              return (
                <div key={monthKey} className="rounded-xl border border-seagreen-light bg-white overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2 bg-seagreen-light/50 border-b border-seagreen-light">
                    <span className="font-semibold text-seagreen-dark">{formatMonth(monthKey)}</span>
                    <span className="font-medium text-seagreen-dark">{formatINR(total)}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Event</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ex) => (
                        <tr key={ex.id} className="border-b border-neutral-50 last:border-0">
                          <td className="px-4 py-2">{formatDate(ex.date)}</td>
                          <td className="px-4 py-2 text-neutral-600">
                            {ex.event_id ? (eventMap.get(ex.event_id) ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}` : String(ex.event_id)) : '—'}
                          </td>
                          <td className="px-4 py-2">{ex.category === 'Other' && ex.category_other ? ex.category_other : ex.category}</td>
                          <td className="px-4 py-2 text-red-700">{formatINR(ex.amount)}</td>
                          <td className="px-4 py-2"><DeleteExpenditureButton id={ex.id} /></td>
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
            <p className="py-8 text-center text-neutral-500">No expenditures.</p>
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
              .map(([eid, items]) => {
                const total = items.reduce((s, x) => s + Number(x.amount), 0);
                const label = eid === 'none' ? 'No event / General' : (eventMap.get(eid) as Event) ? `${formatDate((eventMap.get(eid) as Event).date)} — ${(eventMap.get(eid) as Event).event_type}` : String(eid);
                return (
                  <div key={String(eid)} className="rounded-xl border border-seagreen-light bg-white overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-2 bg-seagreen-light/50 border-b border-seagreen-light">
                      <span className="font-semibold text-seagreen-dark">{label}</span>
                      <span className="font-medium text-seagreen-dark">{formatINR(total)}</span>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Description</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                          <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((ex) => (
                          <tr key={ex.id} className="border-b border-neutral-50 last:border-0">
                            <td className="px-4 py-2">{formatDate(ex.date)}</td>
                            <td className="px-4 py-2">{ex.category === 'Other' && ex.category_other ? ex.category_other : ex.category}</td>
                            <td className="px-4 py-2 text-neutral-600">{ex.description || '—'}</td>
                            <td className="px-4 py-2 text-red-700">{formatINR(ex.amount)}</td>
                            <td className="px-4 py-2"><DeleteExpenditureButton id={ex.id} /></td>
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
            <p className="py-8 text-center text-neutral-500">No expenditures.</p>
          ) : (
            sortedYears.map((year) => {
              const items = byYear.get(year)!;
              const total = items.reduce((s, x) => s + Number(x.amount), 0);
              return (
                <div key={year} className="rounded-xl border border-seagreen-light bg-white overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2 bg-seagreen-light/50 border-b border-seagreen-light">
                    <span className="font-semibold text-seagreen-dark">{year}</span>
                    <span className="font-medium text-seagreen-dark">{formatINR(total)}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="px-4 py-2 font-medium text-neutral-600">Date</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Event</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Category</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Amount</th>
                        <th className="px-4 py-2 font-medium text-neutral-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ex) => (
                        <tr key={ex.id} className="border-b border-neutral-50 last:border-0">
                          <td className="px-4 py-2">{formatDate(ex.date)}</td>
                          <td className="px-4 py-2 text-neutral-600">
                            {ex.event_id ? (eventMap.get(ex.event_id) ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}` : String(ex.event_id)) : '—'}
                          </td>
                          <td className="px-4 py-2">{ex.category === 'Other' && ex.category_other ? ex.category_other : ex.category}</td>
                          <td className="px-4 py-2 text-red-700">{formatINR(ex.amount)}</td>
                          <td className="px-4 py-2"><DeleteExpenditureButton id={ex.id} /></td>
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
