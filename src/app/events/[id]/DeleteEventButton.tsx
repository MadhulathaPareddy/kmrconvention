'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export function DeleteEventButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAdmin !== true) return null;

  async function handleDelete() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a reason for deletion.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete event');
        return;
      }
      router.push('/events');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete event
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-seagreen-light bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-seagreen-dark">Delete event</h3>
            <p className="mt-2 text-sm text-neutral-600">
              You are about to delete: <strong>{eventTitle}</strong>. This will remove the event and its linked expenditures from the active list. A copy will be saved with your reason.
            </p>
            <div className="mt-4">
              <label htmlFor="delete-reason" className="block text-sm font-medium text-neutral-700">
                Why are you deleting this event? *
              </label>
              <textarea
                id="delete-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong date, cancelled event"
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setOpen(false); setError(''); setReason(''); }}
                className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
