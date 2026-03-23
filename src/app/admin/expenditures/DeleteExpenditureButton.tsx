'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteExpenditureButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a reason for deletion.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/expenditures/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === 'string' ? data.error : `Delete failed (${res.status})`
        );
        return;
      }
      setOpen(false);
      setReason('');
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
        className="text-sm text-red-600 hover:text-red-700"
      >
        Delete
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-seagreen-light bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-seagreen-dark">Delete expenditure</h3>
            <p className="mt-2 text-sm text-neutral-600">
              This will remove the expenditure from active records. A copy with your reason will be
              kept for audit.
            </p>
            <div className="mt-4">
              <label htmlFor={`del-exp-${id}`} className="block text-sm font-medium text-neutral-700">
                Reason for deletion *
              </label>
              <textarea
                id={`del-exp-${id}`}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong amount, reclassified"
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError('');
                  setReason('');
                }}
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
