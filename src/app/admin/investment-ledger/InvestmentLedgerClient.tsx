'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatINR, formatDate } from '@/lib/format';
import { istYmd } from '@/lib/ist';
import { INVESTMENT_PARTNERS } from '@/lib/types';
import type {
  LedgerBorrowedFund,
  LedgerBorrowedRepayment,
  LedgerCollectionsDashboard,
  LedgerFundsSpent,
  LedgerPartnerInvestment,
  LedgerPendingPayment,
} from '@/lib/types';

type AddTab = 'partners' | 'borrowed' | 'repayment' | 'spent' | 'pending';
type SectionKey = 'partners' | 'borrowed' | 'spent' | 'pending';

function mergeDashboard(json: Record<string, unknown>): LedgerCollectionsDashboard | null {
  const { ok: _ok, error: _e, ...rest } = json;
  if (
    rest.partners &&
    typeof rest.partners === 'object' &&
    rest.borrowed &&
    rest.spent &&
    rest.pending
  ) {
    return rest as unknown as LedgerCollectionsDashboard;
  }
  return null;
}

export function InvestmentLedgerClient() {
  const [dashboard, setDashboard] = useState<LedgerCollectionsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    partners: false,
    borrowed: false,
    spent: false,
    pending: false,
  });
  const [addTab, setAddTab] = useState<AddTab>('partners');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [partnerForm, setPartnerForm] = useState({
    partner: INVESTMENT_PARTNERS[0] as string,
    partner_other: '',
    amount: '' as string | number,
    note: '',
    entry_date: istYmd(),
  });
  const [borrowForm, setBorrowForm] = useState({
    party_name: '',
    principal: '' as string | number,
    details: '',
    entry_date: istYmd(),
  });
  const [repayForm, setRepayForm] = useState({
    borrowed_fund_id: '',
    amount: '' as string | number,
    note: '',
    payment_date: istYmd(),
  });
  const [spentForm, setSpentForm] = useState({
    amount: '' as string | number,
    category: '',
    description: '',
    note: '',
    spent_date: istYmd(),
  });
  const [pendingForm, setPendingForm] = useState({
    amount: '' as string | number,
    description: '',
    note: '',
    incurred_date: istYmd(),
  });

  const [editKind, setEditKind] = useState<
    'partner' | 'borrowed' | 'spent' | 'pending' | null
  >(null);
  const [editPartner, setEditPartner] = useState<LedgerPartnerInvestment | null>(null);
  const [editBorrowed, setEditBorrowed] = useState<LedgerBorrowedFund | null>(null);
  const [editSpent, setEditSpent] = useState<LedgerFundsSpent | null>(null);
  const [editPending, setEditPending] = useState<LedgerPendingPayment | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ledger-collections');
      if (res.status === 401) {
        setError('Unauthorized');
        setDashboard(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to load');
        setDashboard(null);
        return;
      }
      const d = mergeDashboard(json as Record<string, unknown>);
      setDashboard(d);
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

  function applyPayload(json: Record<string, unknown>) {
    const d = mergeDashboard(json);
    if (d) setDashboard(d);
  }

  function toggle(key: SectionKey) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }

  function partnerNameForCreate(): string {
    if (partnerForm.partner === 'Other') return partnerForm.partner_other.trim();
    return partnerForm.partner;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      let body: Record<string, unknown>;
      if (addTab === 'partners') {
        const name = partnerNameForCreate();
        if (!name) {
          setFormError('Partner name required');
          return;
        }
        body = {
          section: 'partners',
          partner_name: name,
          amount: Number(partnerForm.amount),
          note: partnerForm.note,
          entry_date: partnerForm.entry_date,
        };
      } else if (addTab === 'borrowed') {
        body = {
          section: 'borrowed',
          party_name: borrowForm.party_name,
          principal: Number(borrowForm.principal),
          details: borrowForm.details,
          entry_date: borrowForm.entry_date,
        };
      } else if (addTab === 'repayment') {
        body = {
          section: 'repayment',
          borrowed_fund_id: repayForm.borrowed_fund_id,
          amount: Number(repayForm.amount),
          note: repayForm.note,
          payment_date: repayForm.payment_date,
        };
      } else if (addTab === 'spent') {
        body = {
          section: 'spent',
          amount: Number(spentForm.amount),
          category: spentForm.category,
          description: spentForm.description,
          note: spentForm.note,
          spent_date: spentForm.spent_date,
        };
      } else {
        body = {
          section: 'pending',
          amount: Number(pendingForm.amount),
          description: pendingForm.description,
          note: pendingForm.note,
          incurred_date: pendingForm.incurred_date,
        };
      }

      const res = await fetch('/api/ledger-collections/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setFormError(typeof json.error === 'string' ? json.error : 'Failed');
        return;
      }
      applyPayload(json);
      if (addTab === 'partners') {
        setPartnerForm((f) => ({ ...f, amount: '', note: '', partner_other: '' }));
      } else if (addTab === 'borrowed') {
        setBorrowForm((f) => ({
          ...f,
          party_name: '',
          principal: '',
          details: '',
        }));
      } else if (addTab === 'repayment') {
        setRepayForm((f) => ({ ...f, amount: '', note: '' }));
      } else if (addTab === 'spent') {
        setSpentForm((f) => ({
          ...f,
          amount: '',
          category: '',
          description: '',
          note: '',
        }));
      } else {
        setPendingForm((f) => ({
          ...f,
          amount: '',
          description: '',
          note: '',
        }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRepayment(id: string) {
    if (!confirm('Remove this repayment?')) return;
    const res = await fetch(`/api/ledger-collections/repayments/${id}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (res.ok) applyPayload(json);
  }

  async function saveEdit(ev: FormEvent) {
    ev.preventDefault();
    setEditError('');
    setEditSubmitting(true);
    try {
      let id = '';
      let body: Record<string, unknown> = {};
      if (editKind === 'partner' && editPartner) {
        id = editPartner.id;
        body = {
          section: 'partners',
          partner_name: editPartner.partner_name,
          amount: editPartner.amount,
          note: editPartner.note,
          entry_date: editPartner.entry_date,
        };
      } else if (editKind === 'borrowed' && editBorrowed) {
        id = editBorrowed.id;
        body = {
          section: 'borrowed',
          party_name: editBorrowed.party_name,
          principal: editBorrowed.principal,
          details: editBorrowed.details,
          entry_date: editBorrowed.entry_date,
        };
      } else if (editKind === 'spent' && editSpent) {
        id = editSpent.id;
        body = {
          section: 'spent',
          amount: editSpent.amount,
          category: editSpent.category,
          description: editSpent.description,
          note: editSpent.note,
          spent_date: editSpent.spent_date,
        };
      } else if (editKind === 'pending' && editPending) {
        id = editPending.id;
        body = {
          section: 'pending',
          amount: editPending.amount,
          description: editPending.description,
          note: editPending.note,
          incurred_date: editPending.incurred_date,
        };
      } else {
        return;
      }

      const res = await fetch(`/api/ledger-collections/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setEditError(typeof json.error === 'string' ? json.error : 'Failed');
        return;
      }
      applyPayload(json);
      closeEdit();
    } finally {
      setEditSubmitting(false);
    }
  }

  async function confirmDeleteEdit() {
    if (editKind === 'partner' && editPartner) {
      if (!confirm('Delete this partner investment?')) return;
      const res = await fetch(
        `/api/ledger-collections/items/${editPartner.id}?section=partners`,
        { method: 'DELETE' }
      );
      const json = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        applyPayload(json);
        closeEdit();
      } else setEditError('Delete failed');
    } else if (editKind === 'borrowed' && editBorrowed) {
      if (!confirm('Delete this borrow row and all its repayments?')) return;
      const res = await fetch(
        `/api/ledger-collections/items/${editBorrowed.id}?section=borrowed`,
        { method: 'DELETE' }
      );
      const json = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        applyPayload(json);
        closeEdit();
      } else setEditError('Delete failed');
    } else if (editKind === 'spent' && editSpent) {
      if (!confirm('Delete this spent row?')) return;
      const res = await fetch(`/api/ledger-collections/items/${editSpent.id}?section=spent`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        applyPayload(json);
        closeEdit();
      } else setEditError('Delete failed');
    } else if (editKind === 'pending' && editPending) {
      if (!confirm('Delete this pending item?')) return;
      const res = await fetch(
        `/api/ledger-collections/items/${editPending.id}?section=pending`,
        { method: 'DELETE' }
      );
      const json = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        applyPayload(json);
        closeEdit();
      } else setEditError('Delete failed');
    }
  }

  function closeEdit() {
    setEditKind(null);
    setEditPartner(null);
    setEditBorrowed(null);
    setEditSpent(null);
    setEditPending(null);
    setEditError('');
  }

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading ledger…</p>;
  }
  if (error || !dashboard) {
    return <p className="text-sm text-red-700">{error || 'No data'}</p>;
  }

  const d = dashboard;
  const borrowOptions = d.borrowed.entries;

  return (
    <div className="space-y-8">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        All time · expand a section for line items
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => toggle('partners')}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            expanded.partners
              ? 'border-seagreen bg-seagreen/5 ring-1 ring-seagreen/30'
              : 'border-neutral-200 bg-white hover:border-seagreen-light'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-green-800">
              Invested funds from partners
            </span>
            <span className="text-neutral-400">{expanded.partners ? '▼' : '▶'}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-700">{formatINR(d.partners.total)}</p>
        </button>

        <button
          type="button"
          onClick={() => toggle('borrowed')}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            expanded.borrowed
              ? 'border-orange-300 bg-orange-50/80 ring-1 ring-orange-200'
              : 'border-orange-200 bg-white hover:border-orange-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-orange-900">Borrowed funds</span>
            <span className="text-neutral-400">{expanded.borrowed ? '▼' : '▶'}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-800">
            {formatINR(d.borrowed.total_principal)}
          </p>
          <p className="mt-1 text-xs text-orange-900/80">
            Outstanding: {formatINR(d.borrowed.total_balance)} · Repaid:{' '}
            {formatINR(d.borrowed.total_repaid)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => toggle('spent')}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            expanded.spent
              ? 'border-red-200 bg-red-50/50 ring-1 ring-red-100'
              : 'border-neutral-200 bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-red-800">Funds spent</span>
            <span className="text-neutral-400">{expanded.spent ? '▼' : '▶'}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(d.spent.total)}</p>
        </button>

        <button
          type="button"
          onClick={() => toggle('pending')}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            expanded.pending
              ? 'border-red-200 bg-red-50/50 ring-1 ring-red-100'
              : 'border-neutral-200 bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-red-800">Pending payments</span>
            <span className="text-neutral-400">{expanded.pending ? '▼' : '▶'}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(d.pending.total)}</p>
        </button>
      </div>

      {expanded.partners && (
        <div className="overflow-x-auto rounded-lg border border-green-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-green-100 bg-green-50/50 text-green-900">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Partner</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {d.partners.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                    No partner investments yet.
                  </td>
                </tr>
              ) : (
                d.partners.entries.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(row.entry_date)}</td>
                    <td className="px-3 py-2 font-medium text-green-900">{row.partner_name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-green-800">
                      {formatINR(row.amount)}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-neutral-600">{row.note || '—'}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditKind('partner');
                          setEditPartner({ ...row });
                        }}
                        className="text-seagreen-dark hover:underline"
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
      )}

      {expanded.borrowed && (
        <div className="space-y-4">
          {d.borrowed.entries.length === 0 ? (
            <p className="text-sm text-neutral-500">No borrowed rows yet.</p>
          ) : (
            d.borrowed.entries.map((b) => (
              <div
                key={b.id}
                className="overflow-hidden rounded-lg border border-orange-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 bg-orange-50/40 px-3 py-2">
                  <div>
                    <p className="font-semibold text-orange-950">{b.party_name}</p>
                    <p className="text-xs text-orange-900/80">
                      Principal {formatINR(b.principal)} · Repaid {formatINR(b.total_repaid)} ·
                      Balance {formatINR(b.balance)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditKind('borrowed');
                      setEditBorrowed({ ...b, repayments: [...b.repayments] });
                    }}
                    className="text-sm font-medium text-orange-900 hover:underline"
                  >
                    Edit borrow
                  </button>
                </div>
                {b.details ? (
                  <p className="border-b border-orange-50 px-3 py-2 text-xs text-neutral-600">
                    {b.details}
                  </p>
                ) : null}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-neutral-500">Repayments</p>
                  {b.repayments.length === 0 ? (
                    <p className="text-xs text-neutral-400">None yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {b.repayments.map((r: LedgerBorrowedRepayment) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-50 py-1"
                        >
                          <span>
                            {formatDate(r.payment_date)} · {formatINR(r.amount)}
                            {r.note ? ` · ${r.note}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteRepayment(r.id)}
                            className="text-xs text-red-700 hover:underline"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {expanded.spent && (
        <div className="overflow-x-auto rounded-lg border border-red-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-red-100 bg-red-50/40 text-red-900">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {d.spent.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                    No spent rows yet.
                  </td>
                </tr>
              ) : (
                d.spent.entries.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(row.spent_date)}</td>
                    <td className="px-3 py-2">{row.category || '—'}</td>
                    <td className="max-w-xs px-3 py-2 text-neutral-700">
                      {row.description || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-red-800">
                      {formatINR(row.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditKind('spent');
                          setEditSpent({ ...row });
                        }}
                        className="text-red-800 hover:underline"
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
      )}

      {expanded.pending && (
        <div className="overflow-x-auto rounded-lg border border-red-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-red-100 bg-red-50/40 text-red-900">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Amount due</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {d.pending.entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                    No pending items yet.
                  </td>
                </tr>
              ) : (
                d.pending.entries.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(row.incurred_date)}</td>
                    <td className="max-w-md px-3 py-2 text-neutral-800">{row.description || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-red-800">
                      {formatINR(row.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditKind('pending');
                          setEditPending({ ...row });
                        }}
                        className="text-red-800 hover:underline"
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
      )}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-seagreen-dark">Add to ledger</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['partners', 'Partner investment'],
              ['borrowed', 'Borrowed funds'],
              ['repayment', 'Repay borrowed'],
              ['spent', 'Funds spent'],
              ['pending', 'Pending payment'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAddTab(key);
                setFormError('');
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                addTab === key
                  ? 'bg-seagreen text-white'
                  : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addTab === 'partners' && (
            <>
              <label className="block text-sm sm:col-span-1">
                <span className="text-neutral-600">Partner</span>
                <select
                  value={partnerForm.partner}
                  onChange={(e) =>
                    setPartnerForm((f) => ({
                      ...f,
                      partner: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                >
                  {INVESTMENT_PARTNERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </label>
              {partnerForm.partner === 'Other' && (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-neutral-600">Partner name</span>
                  <input
                    value={partnerForm.partner_other}
                    onChange={(e) =>
                      setPartnerForm((f) => ({ ...f, partner_other: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-neutral-600">Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={partnerForm.amount}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Date</span>
                <input
                  type="date"
                  required
                  value={partnerForm.entry_date}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, entry_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="text-neutral-600">Note</span>
                <input
                  value={partnerForm.note}
                  onChange={(e) => setPartnerForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </>
          )}

          {addTab === 'borrowed' && (
            <>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-600">Lender / party</span>
                <input
                  required
                  value={borrowForm.party_name}
                  onChange={(e) => setBorrowForm((f) => ({ ...f, party_name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Principal (₹)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={borrowForm.principal}
                  onChange={(e) => setBorrowForm((f) => ({ ...f, principal: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Date</span>
                <input
                  type="date"
                  required
                  value={borrowForm.entry_date}
                  onChange={(e) => setBorrowForm((f) => ({ ...f, entry_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="text-neutral-600">Details</span>
                <input
                  value={borrowForm.details}
                  onChange={(e) => setBorrowForm((f) => ({ ...f, details: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </>
          )}

          {addTab === 'repayment' && (
            <>
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="text-neutral-600">Apply to borrowed entry</span>
                <select
                  required
                  value={repayForm.borrowed_fund_id}
                  onChange={(e) =>
                    setRepayForm((f) => ({ ...f, borrowed_fund_id: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                >
                  <option value="">Select…</option>
                  {borrowOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.party_name} · bal {formatINR(b.balance)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Payment amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={repayForm.amount}
                  onChange={(e) => setRepayForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Payment date</span>
                <input
                  type="date"
                  required
                  value={repayForm.payment_date}
                  onChange={(e) => setRepayForm((f) => ({ ...f, payment_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-600">Note</span>
                <input
                  value={repayForm.note}
                  onChange={(e) => setRepayForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </>
          )}

          {addTab === 'spent' && (
            <>
              <label className="block text-sm">
                <span className="text-neutral-600">Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={spentForm.amount}
                  onChange={(e) => setSpentForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Date</span>
                <input
                  type="date"
                  required
                  value={spentForm.spent_date}
                  onChange={(e) => setSpentForm((f) => ({ ...f, spent_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Category</span>
                <input
                  value={spentForm.category}
                  onChange={(e) => setSpentForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-600">Description</span>
                <input
                  value={spentForm.description}
                  onChange={(e) => setSpentForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="text-neutral-600">Note</span>
                <input
                  value={spentForm.note}
                  onChange={(e) => setSpentForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </>
          )}

          {addTab === 'pending' && (
            <>
              <label className="block text-sm">
                <span className="text-neutral-600">Amount due (₹)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={pendingForm.amount}
                  onChange={(e) => setPendingForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Incurred date</span>
                <input
                  type="date"
                  required
                  value={pendingForm.incurred_date}
                  onChange={(e) =>
                    setPendingForm((f) => ({ ...f, incurred_date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-600">Description</span>
                <input
                  required
                  value={pendingForm.description}
                  onChange={(e) =>
                    setPendingForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="text-neutral-600">Note</span>
                <input
                  value={pendingForm.note}
                  onChange={(e) => setPendingForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                />
              </label>
            </>
          )}

          {formError && (
            <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{formError}</p>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={submitting || (addTab === 'repayment' && borrowOptions.length === 0)}
              className="rounded-md bg-seagreen px-4 py-2 text-sm font-medium text-white hover:bg-seagreen-dark disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            {addTab === 'repayment' && borrowOptions.length === 0 ? (
              <span className="ml-2 text-xs text-neutral-500">Add a borrow row first.</span>
            ) : null}
          </div>
        </form>
      </div>

      {editKind && (editPartner || editBorrowed || editSpent || editPending) && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-seagreen-dark">Edit entry</h3>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              {editKind === 'partner' && editPartner && (
                <>
                  <label className="block text-sm">
                    Partner
                    <input
                      value={editPartner.partner_name}
                      onChange={(e) =>
                        setEditPartner({ ...editPartner, partner_name: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Amount
                    <input
                      type="number"
                      min={1}
                      required
                      value={editPartner.amount}
                      onChange={(e) =>
                        setEditPartner({ ...editPartner, amount: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Date
                    <input
                      type="date"
                      required
                      value={editPartner.entry_date}
                      onChange={(e) =>
                        setEditPartner({ ...editPartner, entry_date: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Note
                    <input
                      value={editPartner.note}
                      onChange={(e) => setEditPartner({ ...editPartner, note: e.target.value })}
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                </>
              )}
              {editKind === 'borrowed' && editBorrowed && (
                <>
                  <label className="block text-sm">
                    Party
                    <input
                      value={editBorrowed.party_name}
                      onChange={(e) =>
                        setEditBorrowed({ ...editBorrowed, party_name: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Principal (≥ total repaid {formatINR(editBorrowed.total_repaid)})
                    <input
                      type="number"
                      min={editBorrowed.total_repaid || 1}
                      required
                      value={editBorrowed.principal}
                      onChange={(e) =>
                        setEditBorrowed({
                          ...editBorrowed,
                          principal: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Date
                    <input
                      type="date"
                      required
                      value={editBorrowed.entry_date}
                      onChange={(e) =>
                        setEditBorrowed({ ...editBorrowed, entry_date: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Details
                    <input
                      value={editBorrowed.details}
                      onChange={(e) =>
                        setEditBorrowed({ ...editBorrowed, details: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                </>
              )}
              {editKind === 'spent' && editSpent && (
                <>
                  <label className="block text-sm">
                    Amount
                    <input
                      type="number"
                      min={1}
                      required
                      value={editSpent.amount}
                      onChange={(e) =>
                        setEditSpent({ ...editSpent, amount: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Date
                    <input
                      type="date"
                      required
                      value={editSpent.spent_date}
                      onChange={(e) =>
                        setEditSpent({ ...editSpent, spent_date: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Category
                    <input
                      value={editSpent.category}
                      onChange={(e) =>
                        setEditSpent({ ...editSpent, category: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Description
                    <input
                      value={editSpent.description}
                      onChange={(e) =>
                        setEditSpent({ ...editSpent, description: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Note
                    <input
                      value={editSpent.note}
                      onChange={(e) => setEditSpent({ ...editSpent, note: e.target.value })}
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                </>
              )}
              {editKind === 'pending' && editPending && (
                <>
                  <label className="block text-sm">
                    Amount due
                    <input
                      type="number"
                      min={1}
                      required
                      value={editPending.amount}
                      onChange={(e) =>
                        setEditPending({ ...editPending, amount: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Date
                    <input
                      type="date"
                      required
                      value={editPending.incurred_date}
                      onChange={(e) =>
                        setEditPending({ ...editPending, incurred_date: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Description
                    <input
                      value={editPending.description}
                      onChange={(e) =>
                        setEditPending({ ...editPending, description: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm">
                    Note
                    <input
                      value={editPending.note}
                      onChange={(e) => setEditPending({ ...editPending, note: e.target.value })}
                      className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                  </label>
                </>
              )}
              {editError && <p className="text-sm text-red-700">{editError}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-md bg-seagreen px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteEdit()}
                  className="ml-auto rounded-md border border-red-300 px-4 py-2 text-sm text-red-800"
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
