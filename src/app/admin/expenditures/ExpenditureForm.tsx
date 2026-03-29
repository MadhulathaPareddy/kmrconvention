'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { EXPENDITURE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';
import type { ExpenditureFlow, ExpenditureDeletion } from '@/lib/types';
import { formatDate, formatINR } from '@/lib/format';

type EventOption = { id: string; date: string; event_type: string };

type PanelMode = 'add-expense' | 'add-income' | 'deleted';

function snapshotTransactionDate(row: ExpenditureDeletion): string {
  const s = row.snapshot;
  const d = s?.date;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d != null) {
    try {
      return new Date(d as string | number).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return '';
}

export function ExpenditureForm({ deletions = [] }: { deletions?: ExpenditureDeletion[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<PanelMode>('add-expense');
  const [flow, setFlow] = useState<ExpenditureFlow>('expense');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    category: 'Diesel',
    description: '',
    event_id: '',
    category_other: '',
  });

  const [delFilterEvent, setDelFilterEvent] = useState('');
  const [delFilterMonth, setDelFilterMonth] = useState('');
  const [delFilterYear, setDelFilterYear] = useState('');
  const [delFilterDate, setDelFilterDate] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  const deletionYears = useMemo(() => {
    const y = new Set<string>();
    for (const row of deletions) {
      const sd = snapshotTransactionDate(row);
      if (sd.length >= 4) y.add(sd.slice(0, 4));
    }
    return Array.from(y).sort((a, b) => b.localeCompare(a));
  }, [deletions]);

  const filteredDeletions = useMemo(() => {
    return deletions.filter((row) => {
      const sd = snapshotTransactionDate(row);
      const eid = row.snapshot?.event_id != null ? String(row.snapshot.event_id) : '';
      if (delFilterEvent && eid !== delFilterEvent) return false;
      if (delFilterMonth && !(sd && sd.startsWith(delFilterMonth))) return false;
      if (delFilterYear && sd.slice(0, 4) !== delFilterYear) return false;
      if (delFilterDate && sd !== delFilterDate) return false;
      return true;
    });
  }, [deletions, delFilterEvent, delFilterMonth, delFilterYear, delFilterDate]);

  function setAddFlow(next: ExpenditureFlow) {
    setPanel(next === 'expense' ? 'add-expense' : 'add-income');
    setFlow(next);
    setError('');
    if (next === 'expense') {
      setForm((f) => ({
        ...f,
        category: 'Diesel',
        event_id: f.event_id,
      }));
    } else {
      setForm((f) => ({
        ...f,
        category: 'Royalty — Decor',
        category_other: '',
      }));
    }
  }

  function clearDeletionFilters() {
    setDelFilterEvent('');
    setDelFilterMonth('');
    setDelFilterYear('');
    setDelFilterDate('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (panel === 'deleted') return;
    if (form.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (flow === 'expense') {
      if (!form.event_id && !form.description.trim()) {
        setError('Description is required when the expense is not linked to an event.');
        return;
      }
      if (form.category === 'Other' && !form.category_other.trim()) {
        setError('Please specify the category name when "Other" is selected.');
        return;
      }
    } else {
      if (!form.description.trim()) {
        setError('Reason / notes are required for funds added (royalty).');
        return;
      }
      if (form.category === 'Other' && !form.category_other.trim()) {
        setError('Please describe the source when "Other" is selected (e.g. sponsor, misc).');
        return;
      }
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenditures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          amount: Number(form.amount),
          category: form.category,
          description: form.description.trim() || undefined,
          event_id: form.event_id ? form.event_id : null,
          category_other:
            form.category === 'Other' ? form.category_other.trim() : undefined,
          flow_type: flow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add record');
        return;
      }
      setForm((f) => ({
        ...f,
        amount: 0,
        description: '',
        category_other: '',
      }));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const isAdd = panel === 'add-expense' || panel === 'add-income';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-seagreen-light bg-seagreen-light/30 p-4"
    >
      <h2 className="mb-3 text-lg font-semibold text-seagreen-dark">Add transaction</h2>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddFlow('expense')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              panel === 'add-expense'
                ? 'bg-red-600 text-white'
                : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Funds spent (expense)
          </button>
          <button
            type="button"
            onClick={() => setAddFlow('income')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              panel === 'add-income'
                ? 'bg-green-600 text-white'
                : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Funds added (royalty)
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setPanel('deleted');
            setError('');
          }}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            panel === 'deleted'
              ? 'bg-neutral-800 text-white'
              : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Deleted expenses
        </button>
      </div>

      {panel === 'deleted' ? (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white/80 p-4">
          <p className="text-xs text-neutral-600">
            Admin audit log — rows removed from the active ledger. Use filters together to narrow results
            (e.g. pick a date and an event to match a known booking).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="del-f-event" className="block text-xs font-medium text-neutral-600">
                Event
              </label>
              <select
                id="del-f-event"
                value={delFilterEvent}
                onChange={(e) => setDelFilterEvent(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {formatDate(ev.date)} — {ev.event_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="del-f-month" className="block text-xs font-medium text-neutral-600">
                Month
              </label>
              <input
                id="del-f-month"
                type="month"
                value={delFilterMonth}
                onChange={(e) => setDelFilterMonth(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="del-f-year" className="block text-xs font-medium text-neutral-600">
                Year
              </label>
              <select
                id="del-f-year"
                value={delFilterYear}
                onChange={(e) => setDelFilterYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Any year</option>
                {deletionYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="del-f-date" className="block text-xs font-medium text-neutral-600">
                Specific date
              </label>
              <input
                id="del-f-date"
                type="date"
                value={delFilterDate}
                onChange={(e) => setDelFilterDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearDeletionFilters}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Clear filters
            </button>
            <span className="text-xs text-neutral-500">
              Showing {filteredDeletions.length} of {deletions.length}
            </span>
          </div>

          {filteredDeletions.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              {deletions.length === 0
                ? 'No deleted expenditure records yet.'
                : 'No rows match these filters.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-seagreen-light bg-seagreen-light/40">
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Deleted at</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Txn date</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Event</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Flow</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Category</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Amount</th>
                    <th className="px-3 py-2 font-medium text-seagreen-dark">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletions.map((row) => {
                    const s = row.snapshot;
                    const sd = snapshotTransactionDate(row);
                    const eid =
                      s?.event_id != null && String(s.event_id) ? String(s.event_id) : '';
                    const ev = eid ? events.find((x) => x.id === eid) : null;
                    const eventLabel = ev
                      ? `${formatDate(ev.date)} — ${ev.event_type}`
                      : eid || '—';
                    const cat =
                      s?.category === 'Other' && typeof s.category_other === 'string'
                        ? s.category_other
                        : String(s?.category ?? '—');
                    const amount = typeof s?.amount === 'number' ? s.amount : Number(s?.amount);
                    const ft = s?.flow_type === 'income' ? 'income' : 'expense';
                    return (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-3 py-2 text-neutral-700">
                          {new Date(row.deleted_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-3 py-2">{sd ? formatDate(sd) : '—'}</td>
                        <td className="px-3 py-2 text-neutral-600">{eventLabel}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              ft === 'income'
                                ? 'rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                                : 'rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'
                            }
                          >
                            {ft === 'income' ? 'Royalty' : 'Expense'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{cat}</td>
                        <td className="px-3 py-2 font-medium text-neutral-800">
                          {Number.isNaN(amount) ? '—' : formatINR(amount)}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 text-neutral-800">{row.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-neutral-600">
            {flow === 'expense'
              ? 'Money leaving the hall account — shown as expense in lists. Same categories as before.'
              : 'Decor/kitchen royalty or other inflows — shown in green. Reason is required. Optionally tag an event so this amount counts toward Summary revenue for that booking (in the month of the date above).'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label htmlFor="ex-date" className="block text-xs font-medium text-neutral-600">
                Date *
              </label>
              <input
                id="ex-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="ex-event" className="block text-xs font-medium text-neutral-600">
                {flow === 'expense' ? 'Link to event' : 'Tag event (optional)'}
              </label>
              <select
                id="ex-event"
                value={form.event_id}
                onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">
                  {flow === 'expense' ? 'No event / current month' : 'None — not tied to a booking'}
                </option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {formatDate(ev.date)} — {ev.event_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ex-amount" className="block text-xs font-medium text-neutral-600">
                Amount (₹) *
              </label>
              <input
                id="ex-amount"
                type="number"
                min={1}
                value={form.amount || ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))
                }
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="ex-category" className="block text-xs font-medium text-neutral-600">
                {flow === 'expense' ? 'Category *' : 'Type *'}
              </label>
              <select
                id="ex-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                {(flow === 'expense' ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ex-desc" className="block text-xs font-medium text-neutral-600">
                {flow === 'income'
                  ? 'Reason / notes *'
                  : !form.event_id
                    ? 'Description *'
                    : 'Description (optional if linked to event)'}
              </label>
              <input
                id="ex-desc"
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder={
                  flow === 'income'
                    ? 'e.g. Partner investment, decor settlement for May wedding'
                    : 'e.g. Generator fuel, staff salary'
                }
                required={flow === 'income' || !form.event_id}
              />
            </div>
            {form.category === 'Other' && (
              <div>
                <label
                  htmlFor="ex-category-other"
                  className="block text-xs font-medium text-neutral-600"
                >
                  {flow === 'expense' ? 'Specify category name *' : 'Describe source *'}
                </label>
                <input
                  id="ex-category-other"
                  type="text"
                  value={form.category_other}
                  onChange={(e) => setForm((f) => ({ ...f, category_other: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  placeholder={flow === 'expense' ? 'e.g. Repairs' : 'e.g. Sponsor contribution'}
                  required
                />
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
            >
              {submitting ? 'Adding…' : flow === 'expense' ? 'Add expense' : 'Add royalty'}
            </button>
          </div>
        </>
      )}
      {error && isAdd && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
