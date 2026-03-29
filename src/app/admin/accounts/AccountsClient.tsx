'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  Event,
  LoanAccountDashboard,
  LoanAccountEntry,
  LoanAccountEntryKind,
} from '@/lib/types';
import { formatINR, formatDate, formatDateTime } from '@/lib/format';

type Tab = 'loan' | 'other';

function eventLabel(ev: Event): string {
  return `${formatDate(ev.date)} · ${ev.event_type}`;
}

function entryEventDisplay(
  entry: LoanAccountEntry,
  eventById: Map<string, Event>
): string {
  if (entry.entry_kind === 'emi_payment') return '—';
  if (!entry.event_id) return 'Event removed';
  const ev = eventById.get(entry.event_id);
  return ev ? eventLabel(ev) : entry.event_id.slice(0, 8) + '…';
}

function pickDashboard(json: Record<string, unknown>): LoanAccountDashboard | null {
  const copy = { ...json };
  delete copy.ok;
  delete copy.entry;
  delete copy.error;
  if (!Array.isArray(copy.entries)) return null;
  return copy as unknown as LoanAccountDashboard;
}

export function AccountsClient() {
  const [tab, setTab] = useState<Tab>('loan');
  const [dashboard, setDashboard] = useState<LoanAccountDashboard | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formKind, setFormKind] = useState<LoanAccountEntryKind>('transfer_from_event');
  const [formEventId, setFormEventId] = useState('');
  const [formAmount, setFormAmount] = useState<string | number>('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [editing, setEditing] = useState<LoanAccountEntry | null>(null);
  const [editKind, setEditKind] = useState<LoanAccountEntryKind>('transfer_from_event');
  const [editEventId, setEditEventId] = useState('');
  const [editAmount, setEditAmount] = useState<string | number>('');
  const [editNote, setEditNote] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const eventById = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const applyPayload = useCallback((json: Record<string, unknown>) => {
    const d = pickDashboard(json);
    if (d) setDashboard(d);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, evRes] = await Promise.all([
        fetch('/api/loan-account'),
        fetch('/api/events'),
      ]);
      if (dashRes.status === 401 || evRes.status === 401) {
        setError('Unauthorized');
        setDashboard(null);
        return;
      }
      const dashJson = await dashRes.json();
      const evJson = await evRes.json();
      if (!dashRes.ok) {
        setError(typeof dashJson.error === 'string' ? dashJson.error : 'Failed to load');
        setDashboard(null);
        return;
      }
      const d = pickDashboard(dashJson as Record<string, unknown>);
      setDashboard(d);
      setEvents(Array.isArray(evJson) ? (evJson as Event[]) : []);
    } catch {
      setError('Failed to load');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/loan-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_kind: formKind,
          event_id: formKind === 'transfer_from_event' ? formEventId : null,
          amount: Number(formAmount),
          note: formNote,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setFormError(typeof json.error === 'string' ? json.error : 'Failed');
        return;
      }
      applyPayload(json);
      setFormAmount('');
      setFormNote('');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(entry: LoanAccountEntry) {
    setEditing(entry);
    setEditKind(entry.entry_kind);
    setEditEventId(entry.event_id ?? '');
    setEditAmount(entry.amount);
    setEditNote(entry.note);
    setEditError('');
  }

  async function saveEdit(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/loan-account/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_kind: editKind,
          event_id: editKind === 'transfer_from_event' ? editEventId : null,
          amount: Number(editAmount),
          note: editNote,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setEditError(typeof json.error === 'string' ? json.error : 'Failed');
        return;
      }
      applyPayload(json);
      setEditing(null);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!editing) return;
    if (!confirm('Delete this entry? All summary numbers will refresh from the ledger.')) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/loan-account/${editing.id}`, { method: 'DELETE' });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setEditError(typeof json.error === 'string' ? json.error : 'Failed');
        return;
      }
      applyPayload(json);
      setEditing(null);
    } finally {
      setEditSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading accounts…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }
  if (!dashboard) {
    return <p className="text-sm text-neutral-600">No data.</p>;
  }

  const d = dashboard;
  const splitCheck = d.other_account_balance + d.loan_balance + d.total_emi_payments;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('loan')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === 'loan'
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Loan account
        </button>
        <button
          type="button"
          onClick={() => setTab('other')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === 'other'
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Other account
        </button>
      </div>

      {tab === 'other' && (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-700">
            This view is <strong>read-only</strong>. It shows profit that has{' '}
            <em>not</em> been earmarked for the loan pool (hall operating profit minus all transfers
            from events into the loan account).
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Hall revenue (all-time, same as Summary)</dt>
              <dd className="text-lg font-semibold text-seagreen-dark">{formatINR(d.hall_revenue)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Hall expenses (all-time)</dt>
              <dd className="text-lg font-semibold text-neutral-800">{formatINR(d.hall_expenditure)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Hall operating profit</dt>
              <dd className="text-lg font-semibold text-seagreen-dark">{formatINR(d.hall_profit)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Moved to loan (from events, cumulative)</dt>
              <dd className="text-lg font-semibold text-neutral-800">
                {formatINR(d.total_transfers_from_events)}
              </dd>
            </div>
            <div className="sm:col-span-2 border-t border-neutral-200 pt-3">
              <dt className="text-neutral-500">Other account balance (remaining)</dt>
              <dd
                className={`text-xl font-bold ${
                  d.other_account_balance < 0 ? 'text-red-700' : 'text-seagreen-dark'
                }`}
              >
                {formatINR(d.other_account_balance)}
              </dd>
              {d.other_account_balance < 0 && (
                <p className="mt-1 text-xs text-red-700">
                  Transfers to the loan account exceed hall profit in this model — review entries on
                  the Loan account tab.
                </p>
              )}
            </div>
          </dl>
          <p className="text-xs text-neutral-500">
            Check: operating profit ≈ other + loan balance + EMI paid (
            {formatINR(splitCheck)}
            {splitCheck !== d.hall_profit ? ` — diff ${formatINR(d.hall_profit - splitCheck)}` : ''}).
          </p>
        </div>
      )}

      {tab === 'loan' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-neutral-500">Hall operating profit</p>
              <p className="text-lg font-semibold text-seagreen-dark">{formatINR(d.hall_profit)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-neutral-500">Transferred from events (total)</p>
              <p className="text-lg font-semibold text-neutral-800">
                {formatINR(d.total_transfers_from_events)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-neutral-500">EMI / outflows from loan</p>
              <p className="text-lg font-semibold text-neutral-800">
                {formatINR(d.total_emi_payments)}
              </p>
            </div>
            <div className="rounded-lg border border-seagreen-light bg-seagreen/5 p-3 shadow-sm sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-neutral-500">Loan account balance</p>
              <p className="text-lg font-semibold text-seagreen-dark">{formatINR(d.loan_balance)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:col-span-2 lg:col-span-2">
              <p className="text-xs font-medium text-neutral-500">Other account (see Other tab)</p>
              <p className="text-lg font-semibold text-neutral-800">
                {formatINR(d.other_account_balance)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-seagreen-dark">Add movement</h2>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm">
                <span className="text-neutral-600">Type</span>
                <select
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as LoanAccountEntryKind)
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  <option value="transfer_from_event">From event → loan</option>
                  <option value="emi_payment">EMI / payment from loan</option>
                </select>
              </label>
              {formKind === 'transfer_from_event' ? (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-neutral-600">Event</span>
                  <select
                    required
                    value={formEventId}
                    onChange={(e) => setFormEventId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select event…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {eventLabel(ev)} · {formatINR(ev.price)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-neutral-500 sm:col-span-2 self-end pb-1">
                  EMI entries are not tied to a single event.
                </p>
              )}
              <label className="block text-sm">
                <span className="text-neutral-600">Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-sm sm:col-span-2 lg:col-span-4">
                <span className="text-neutral-600">Note</span>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Reason or comment"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              {formError && (
                <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{formError}</p>
              )}
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Add entry'}
                </button>
              </div>
            </form>
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {d.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  d.entries.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100">
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        {row.entry_kind === 'emi_payment' ? (
                          <span className="text-amber-800">EMI / out</span>
                        ) : (
                          <span className="text-seagreen-dark">From event</span>
                        )}
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-2 text-neutral-700">
                        {entryEventDisplay(row, eventById)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        {formatINR(row.amount)}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-neutral-600">
                        {row.note || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-seagreen-dark hover:text-seagreen"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-seagreen-dark">Edit entry</h3>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-neutral-600">Type</span>
                <select
                  value={editKind}
                  onChange={(e) =>
                    setEditKind(e.target.value as LoanAccountEntryKind)
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  <option value="transfer_from_event">From event → loan</option>
                  <option value="emi_payment">EMI / payment from loan</option>
                </select>
              </label>
              {editKind === 'transfer_from_event' ? (
                <label className="block text-sm">
                  <span className="text-neutral-600">Event</span>
                  <select
                    required
                    value={editEventId}
                    onChange={(e) => setEditEventId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select event…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {eventLabel(ev)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-sm">
                <span className="text-neutral-600">Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Note</span>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              {editError && <p className="text-sm text-red-700">{editError}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={editSubmitting}
                  className="ml-auto rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
