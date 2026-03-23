'use client';

import { useEffect, useState } from 'react';
import type { EventHistoryEntry } from '@/lib/types';
import { formatINR } from '@/lib/format';

function formatChangedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function diffLabel(key: string): string {
  const labels: Record<string, string> = {
    date: 'Date',
    event_type: 'Event type',
    contact_info: 'Contact',
    price: 'Price',
    diesel_type: 'Incl_Diesel',
    diesel_expenditure_suppressed: 'Diesel line removed',
    notes: 'Notes',
  };
  return labels[key] ?? key;
}

function formatValue(key: string, val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (key === 'price' && typeof val === 'number') return formatINR(val);
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleDateString('en-IN');
    } catch {
      return val;
    }
  }
  return String(val);
}

export function EventHistorySection({ eventId }: { eventId: string }) {
  const [history, setHistory] = useState<EventHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/history`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: EventHistoryEntry[]) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-seagreen-light bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-seagreen-dark">Update history</h2>
        <p className="mt-2 text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-seagreen-light bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-seagreen-dark">Update history</h2>
        <p className="mt-2 text-sm text-neutral-500">No updates yet. Edits will appear here (latest first).</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-seagreen-light bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-seagreen-dark">Update history</h2>
      <p className="mt-1 text-sm text-neutral-500">All changes from the beginning (latest first).</p>
      <ul className="mt-4 space-y-4">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-sm"
          >
            <div className="font-medium text-neutral-700">
              Updated at {formatChangedAt(entry.changed_at)}
            </div>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(entry.snapshot_before || {}).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-neutral-500">{diffLabel(key)}</dt>
                  <dd className="font-medium text-neutral-800">{formatValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
