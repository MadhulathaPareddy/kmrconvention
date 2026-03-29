'use client';

import { useEffect, useState } from 'react';
import type { EventHistoryEntry } from '@/lib/types';
import { EventHistoryList } from '../EventHistoryList';

export function EventHistorySection({ eventId }: { eventId: string }) {
  const [history, setHistory] = useState<EventHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EventHistoryEntry[]) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
      <p className="mt-1 text-sm text-neutral-500">
        All changes from the beginning (latest first). Each block shows field values before that save and
        the comment from the editor.
      </p>
      <EventHistoryList entries={history} />
    </div>
  );
}
