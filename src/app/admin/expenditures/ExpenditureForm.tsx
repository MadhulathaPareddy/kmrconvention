'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { EXPENDITURE_CATEGORIES } from '@/lib/types';
import { formatDate } from '@/lib/format';

type EventOption = { id: string; date: string; event_type: string };

export function ExpenditureForm() {
  const router = useRouter();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    category: 'Diesel',
    description: '',
    event_id: '',
    category_other: '',
  });

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!form.event_id && !form.description.trim()) {
      setError('Description is required when the expense is not linked to an event.');
      return;
    }
    if (form.category === 'Other' && !form.category_other.trim()) {
      setError('Please specify the category name when "Other" is selected.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenditures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          event_id: form.event_id || null,
          category_other: form.category === 'Other' ? form.category_other.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add expenditure');
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-seagreen-light bg-seagreen-light/30 p-4"
    >
      <h2 className="mb-4 text-lg font-semibold text-seagreen-dark">Add expenditure</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            Link to event
          </label>
          <select
            id="ex-event"
            value={form.event_id}
            onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">No event / current month</option>
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
            Category *
          </label>
          <select
            id="ex-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            {EXPENDITURE_CATEGORIES.map((c) => (
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
            Description {!form.event_id ? '*' : '(required if not linked to event)'}
          </label>
          <input
            id="ex-desc"
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            placeholder="e.g. Generator fuel, staff salary"
            required={!form.event_id}
          />
        </div>
        {form.category === 'Other' && (
          <div>
            <label htmlFor="ex-category-other" className="block text-xs font-medium text-neutral-600">
              Specify category name *
            </label>
            <input
              id="ex-category-other"
              type="text"
              value={form.category_other}
              onChange={(e) => setForm((f) => ({ ...f, category_other: e.target.value }))}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="e.g. Repairs, Miscellaneous"
              required={form.category === 'Other'}
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
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
