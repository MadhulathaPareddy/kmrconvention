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

export function ExpenditureViews({
  expenditures,
  events,
}: {
  expenditures: Expenditure[];
  events: Event[];
}) {
  const [view, setView] = useState<'monthly' | 'event' | 'yearly'>('monthly');

  const byMonth = new Map<string, Expenditure[]>();
  const byEvent = new Map<string | 'none', Expenditure[]>();
  const byYear = new Map<number, Expenditure[]>();
  const eventMap = new Map(events.map((e) => [e.id, e]));

  for (const ex of expenditures) {
    const monthKey = ex.date.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(ex);

    const eid = ex.event_id ?? 'none';
    if (!byEvent.has(eid)) byEvent.set(eid, []);
    byEvent.get(eid)!.push(ex);

    const year = new Date(ex.date).getFullYear();
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
              const total = items.reduce((s, x) => s + x.amount, 0);
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
                            {ex.event_id ? (eventMap.get(ex.event_id) ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}` : ex.event_id) : '—'}
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
                return dateB.localeCompare(dateA);
              })
              .map(([eid, items]) => {
                const total = items.reduce((s, x) => s + x.amount, 0);
                const label = eid === 'none' ? 'No event / General' : (eventMap.get(eid) as Event) ? `${formatDate((eventMap.get(eid) as Event).date)} — ${(eventMap.get(eid) as Event).event_type}` : eid;
                return (
                  <div key={eid} className="rounded-xl border border-seagreen-light bg-white overflow-hidden">
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
              const total = items.reduce((s, x) => s + x.amount, 0);
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
                            {ex.event_id ? (eventMap.get(ex.event_id) ? `${formatDate((eventMap.get(ex.event_id)! as Event).date)} — ${(eventMap.get(ex.event_id)! as Event).event_type}` : ex.event_id) : '—'}
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
