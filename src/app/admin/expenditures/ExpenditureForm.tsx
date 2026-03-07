'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EXPENDITURE_CATEGORIES } from '@/lib/types';

export function ExpenditureForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    category: 'Diesel',
    description: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.amount <= 0) {
      setError('Amount must be greater than 0');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add expenditure');
        return;
      }
      setForm((f) => ({ ...f, amount: 0, description: '' }));
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
        <div className="sm:col-span-2 lg:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="ex-desc" className="block text-xs font-medium text-neutral-600">
          Description (optional)
        </label>
        <input
          id="ex-desc"
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          placeholder="e.g. Generator fuel, staff salary"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
