'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EVENT_TYPES, DIESEL_OPTIONS } from '@/lib/types';

export default function AddEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    event_type: 'Marriage',
    contact_info: '',
    price: 200000,
    decor_royalty: 0,
    kitchen_royalty: 0,
    diesel_amount: 30000,
    diesel_type: null as 'KMR' | 'GUEST' | null,
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
          diesel_type: form.diesel_type,
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
        <div>
          <label htmlFor="decor_royalty" className="block text-sm font-medium text-neutral-700">
            Decor royalty (₹)
          </label>
          <input
            id="decor_royalty"
            type="number"
            min={0}
            value={form.decor_royalty}
            onChange={(e) => setForm((f) => ({ ...f, decor_royalty: Number(e.target.value) || 0 }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="kitchen_royalty" className="block text-sm font-medium text-neutral-700">
            Kitchen royalty (₹)
          </label>
          <input
            id="kitchen_royalty"
            type="number"
            min={0}
            value={form.kitchen_royalty}
            onChange={(e) => setForm((f) => ({ ...f, kitchen_royalty: Number(e.target.value) || 0 }))}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="diesel_type" className="block text-sm font-medium text-neutral-700">
            Incl_Diesel
          </label>
          <select
            id="diesel_type"
            value={form.diesel_type ?? ''}
            onChange={(e) => {
              const v = e.target.value === 'KMR' ? 'KMR' : e.target.value === 'GUEST' ? 'GUEST' : null;
              setForm((f) => ({
                ...f,
                diesel_type: v,
                diesel_amount: v && f.diesel_amount <= 0 ? 30000 : f.diesel_amount,
              }));
            }}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
          >
            {DIESEL_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {(form.diesel_type === 'KMR' || form.diesel_type === 'GUEST') && (
          <div>
            <label htmlFor="diesel_amount" className="block text-sm font-medium text-neutral-700">
              Diesel amount (₹)
            </label>
            <input
              id="diesel_amount"
              type="number"
              min={0}
              value={form.diesel_amount}
              onChange={(e) => setForm((f) => ({ ...f, diesel_amount: Number(e.target.value) || 0 }))}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Used for the linked Diesel expenditure. Leave 0 to use default ₹30,000.
            </p>
          </div>
        )}
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
