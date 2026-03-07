'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EVENT_TYPES } from '@/lib/types';

export default function AddEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    event_type: 'Marriage',
    contact_info: '',
    price: 200000,
    diesel_included: false,
    notes: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add event');
        return;
      }
      router.push('/events?added=1');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-seagreen-dark">Add event</h1>
      <p className="text-sm text-neutral-600">
        Required: Date, event type, and price. Saved events are visible to all users immediately.
      </p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-seagreen-light bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-neutral-700">
            Date *
          </label>
          <input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="event_type" className="block text-sm font-medium text-neutral-700">
            Event type *
          </label>
          <select
            id="event_type"
            value={form.event_type}
            onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contact_info" className="block text-sm font-medium text-neutral-700">
            Contact info
          </label>
          <input
            id="contact_info"
            type="text"
            value={form.contact_info}
            onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
            placeholder="e.g. Name or phone"
          />
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-neutral-700">
            Price (₹) *
          </label>
          <input
            id="price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="diesel"
            type="checkbox"
            checked={form.diesel_included}
            onChange={(e) => setForm((f) => ({ ...f, diesel_included: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-seagreen"
          />
          <label htmlFor="diesel" className="text-sm font-medium text-neutral-700">
            Diesel included
          </label>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
            Notes
          </label>
          <textarea
            id="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-seagreen px-4 py-2 font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save event'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-neutral-200 px-4 py-2 font-medium hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
