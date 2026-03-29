'use client';

import { useEffect, useState } from 'react';
import type { EventHistoryEntry } from '@/lib/types';
import { EventHistoryList } from './EventHistoryList';

type Props = {
  eventId: string;
  open: boolean;
  onClose: () => void;
};

export function EventChangesModal({ eventId, open, onClose }: Props) {
  const [history, setHistory] = useState<EventHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/events/${eventId}/history`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load history');
        }
        return data as EventHistoryEntry[];
      })
      .then((data) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-changes-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-seagreen-light bg-seagreen-light/30 px-5 py-4">
          <h2 id="event-changes-title" className="text-lg font-semibold text-seagreen-dark">
            Update history
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-seagreen-dark hover:bg-white/80"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-neutral-500">
            Each entry shows the values <strong>before</strong> that save (latest first), and the
            comment left when saving.
          </p>
          {loading && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {!loading && !error ? <EventHistoryList entries={history} /> : null}
        </div>
      </div>
    </div>
  );
}
