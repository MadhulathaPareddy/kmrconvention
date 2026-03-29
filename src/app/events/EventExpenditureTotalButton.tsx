'use client';

import { useEffect, useState } from 'react';
import { formatINR, formatDate } from '@/lib/format';
import type { Expenditure } from '@/lib/types';

function categoryLabel(ex: Expenditure): string {
  if (ex.category === 'Other' && ex.category_other) return ex.category_other;
  return ex.category;
}

function EventExpenditureModalBody({
  eventId,
  eventLabel,
  total,
  onClose,
}: {
  eventId: string;
  eventLabel: string;
  total: number;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/expenditures`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load');
        }
        return data as Expenditure[];
      })
      .then((data) => {
        if (!cancelled) setLines(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-exp-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-seagreen-light bg-seagreen-light/30 px-4 py-3">
          <h2 id="ev-exp-title" className="text-sm font-semibold text-seagreen-dark">
            Expenses · {eventLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-medium text-seagreen-dark hover:bg-white/80"
          >
            Close
          </button>
        </div>
        <div className="max-h-[min(60vh,24rem)] overflow-y-auto p-4">
          <p className="text-xs text-neutral-500">
            Active expense lines linked to this event (linked spend only). Total{' '}
            <span className="font-medium text-neutral-800">{formatINR(total)}</span>.
          </p>
          {loading && <p className="mt-3 text-sm text-neutral-500">Loading…</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {!loading && !error && lines.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No linked expense lines.</p>
          ) : null}
          {!loading && !error && lines.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
              {lines.map((ex) => (
                <li key={ex.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-neutral-800">{formatDate(ex.date)}</span>
                    <span className="font-semibold text-red-700">{formatINR(ex.amount)}</span>
                  </div>
                  <p className="text-xs text-neutral-500">{categoryLabel(ex)}</p>
                  {ex.description ? (
                    <p className="mt-0.5 text-neutral-700">{ex.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Props = {
  eventId: string;
  eventLabel: string;
  total: number;
};

export function EventExpenditureTotalButton({ eventId, eventLabel, total }: Props) {
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModalKey((k) => k + 1);
          setOpen(true);
        }}
        className="text-left font-medium text-seagreen-dark underline decoration-seagreen-light underline-offset-2 hover:text-seagreen"
      >
        {formatINR(total)}
      </button>
      {open ? (
        <EventExpenditureModalBody
          key={modalKey}
          eventId={eventId}
          eventLabel={eventLabel}
          total={total}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
