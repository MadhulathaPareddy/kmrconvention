'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR, formatDate } from '@/lib/format';
import { INVESTMENT_PARTNERS } from '@/lib/types';
import type {
  InvestmentLedgerEntry,
  InvestmentPendingBill,
  InvestmentLedgerAuditRow,
  InvestmentPartner,
} from '@/lib/types';

type RangePreset = 'month' | 'week' | 'year' | 'all' | 'custom';

type InflowTab = 'partner' | 'external';

type LedgerResponse = {
  entries: InvestmentLedgerEntry[];
  openPending: InvestmentPendingBill[];
  pendingInRange: InvestmentPendingBill[];
  summary: {
    total_in: number;
    total_out: number;
    net: number;
    open_pending_count: number;
    open_pending_remaining: number;
  };
};

function buildQuery(range: RangePreset, from: string, to: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay();
  if (range === 'all') return '';
  if (range === 'month') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return `from=${start.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}`;
  }
  if (range === 'week') {
    const start = new Date(y, m, d - dayOfWeek);
    const end = new Date(y, m, d - dayOfWeek + 6);
    return `from=${start.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}`;
  }
  if (range === 'year') {
    return `from=${y}-01-01&to=${y}-12-31`;
  }
  if (range === 'custom' && from && to) {
    return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }
  return '';
}

function entryLabel(e: InvestmentLedgerEntry): string {
  switch (e.entry_kind) {
    case 'partner_investment':
      return e.partner_name ? `Partner — ${e.partner_name}` : 'Partner investment';
    case 'external_borrow':
      return e.external_party_name
        ? `External borrow — ${e.external_party_name}`
        : 'External borrow';
    case 'expense':
      return e.expense_type ? `Expense — ${e.expense_type}` : 'Expense';
    case 'pending_payment':
      return 'Pending bill payment';
    default:
      return e.entry_kind;
  }
}

export function InvestmentLedgerClient() {
  const [range, setRange] = useState<RangePreset>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [flowTab, setFlowTab] = useState<'in' | 'out'>('in');
  const [inflowTab, setInflowTab] = useState<InflowTab>('partner');

  const [partnerForm, setPartnerForm] = useState<{
    date: string;
    partner: InvestmentPartner;
    amount: string | number;
    description: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    partner: INVESTMENT_PARTNERS[0],
    amount: '',
    description: '',
  });
  const [externalForm, setExternalForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    external_party_name: '',
    external_details: '',
    amount: '' as string | number,
  });
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    expense_type: '',
    description: '',
    amount: '' as string | number,
    /** Portion not yet paid; 0 = no pending (full amount booked as spent). */
    pending_amount: '' as string | number,
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [payBill, setPayBill] = useState<InvestmentPendingBill | null>(null);
  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '' as string | number,
    paid_by: '',
    description: '',
  });

  const [auditModal, setAuditModal] = useState<{
    title: string;
    refType: string;
    refId: string;
    rows: InvestmentLedgerAuditRow[] | null;
    loading: boolean;
  } | null>(null);

  const [ledgerExpanded, setLedgerExpanded] = useState(false);
  const [pendingPeriodExpanded, setPendingPeriodExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = buildQuery(range, from, to);
      const url = q ? `/api/investment-ledger?${q}` : '/api/investment-ledger';
      const res = await fetch(url);
      if (res.status === 401) {
        setError('Unauthorized');
        setData(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load');
        setData(null);
        return;
      }
      setData(json as LedgerResponse);
    } catch {
      setError('Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => {
    if (range === 'custom' && (!from || !to)) {
      setLoading(false);
      setData(null);
      return;
    }
    load();
  }, [load, range, from, to]);

  useEffect(() => {
    setLedgerExpanded(false);
    setPendingPeriodExpanded(false);
  }, [range, from, to]);

  useEffect(() => {
    if (!pendingModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingModalOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingModalOpen]);

  async function openAudit(title: string, refType: string, refId: string) {
    setAuditModal({ title, refType, refId, rows: null, loading: true });
    try {
      const res = await fetch(
        `/api/investment-ledger/audit?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`
      );
      const rows = res.ok ? ((await res.json()) as InvestmentLedgerAuditRow[]) : [];
      setAuditModal({ title, refType, refId, rows, loading: false });
    } catch {
      setAuditModal({ title, refType, refId, rows: [], loading: false });
    }
  }

  async function postAction(body: Record<string, unknown>) {
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/investment-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Request failed');
        return;
      }
      await load();
      return true;
    } catch {
      setFormError('Request failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPartner(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(partnerForm.amount);
    if (amount <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    const ok = await postAction({
      action: 'partner_in',
      date: partnerForm.date,
      partner: partnerForm.partner,
      amount,
      description: partnerForm.description.trim() || undefined,
    });
    if (ok) {
      setPartnerForm((f) => ({ ...f, amount: '', description: '' }));
    }
  }

  async function submitExternal(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(externalForm.amount);
    if (amount <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    if (!externalForm.external_party_name.trim() || !externalForm.external_details.trim()) {
      setFormError('Name and details are required');
      return;
    }
    const ok = await postAction({
      action: 'external_borrow',
      date: externalForm.date,
      external_party_name: externalForm.external_party_name.trim(),
      external_details: externalForm.external_details.trim(),
      amount,
    });
    if (ok) {
      setExternalForm((f) => ({
        ...f,
        amount: '',
        external_party_name: '',
        external_details: '',
      }));
    }
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (amount <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    if (!expenseForm.expense_type.trim() || !expenseForm.description.trim()) {
      setFormError('Expense type and description are required');
      return;
    }
    const pendingRaw = expenseForm.pending_amount;
    const pending_amount =
      pendingRaw === '' || pendingRaw === null || pendingRaw === undefined
        ? 0
        : Number(pendingRaw);
    if (Number.isNaN(pending_amount) || pending_amount < 0) {
      setFormError('Pending amount must be 0 or more');
      return;
    }
    if (pending_amount > amount) {
      setFormError('Pending cannot exceed total amount');
      return;
    }
    const ok = await postAction({
      action: 'expense',
      date: expenseForm.date,
      expense_type: expenseForm.expense_type.trim(),
      description: expenseForm.description.trim(),
      amount,
      pending_amount,
    });
    if (ok) {
      setExpenseForm((f) => ({
        ...f,
        amount: '',
        description: '',
        expense_type: '',
        pending_amount: '',
      }));
    }
  }

  async function submitPay(e: React.FormEvent) {
    e.preventDefault();
    if (!payBill) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    if (!payForm.paid_by.trim() || !payForm.description.trim()) {
      setFormError('Who paid and description are required');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/investment-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_pending',
          pending_bill_id: payBill.id,
          date: payForm.date,
          amount,
          paid_by: payForm.paid_by.trim(),
          description: payForm.description.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Payment failed');
        return;
      }
      setPayBill(null);
      setPayForm({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        paid_by: '',
        description: '',
      });
      await load();
    } catch {
      setFormError('Payment failed');
    } finally {
      setSubmitting(false);
    }
  }

  const s = data?.summary;
  const openPendingCount = data?.openPending?.length ?? 0;
  const pendingInPeriodCount = data?.pendingInRange?.length ?? 0;
  const entryCount = data?.entries?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-2 border-b border-seagreen-light pb-4">
        <span className="mr-2 text-sm font-medium text-neutral-600">Summary period</span>
        {(['month', 'week', 'year', 'all'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              range === r
                ? 'bg-seagreen text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {r === 'month' ? 'This month' : r === 'week' ? 'This week' : r === 'year' ? 'This year' : 'All time'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRange('custom')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            range === 'custom'
              ? 'bg-seagreen text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Custom
        </button>
        {range === 'custom' && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => load()}
              className="rounded-md bg-seagreen px-3 py-1 text-sm text-white hover:bg-seagreen-dark"
            >
              Apply
            </button>
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {range === 'custom' && (!from || !to) && (
        <p className="text-sm text-neutral-500">
          Choose From and To dates; the list refreshes when both are set (Apply also refreshes).
        </p>
      )}

      {loading && <p className="text-neutral-500">Loading…</p>}

      {s && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-seagreen-light bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Funds in (period)</p>
            <p className="mt-1 text-xl font-semibold text-green-700">{formatINR(s.total_in)}</p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Funds spent (period)</p>
            <p className="mt-1 text-xl font-semibold text-red-700">{formatINR(s.total_out)}</p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Net (period)</p>
            <p
              className={`mt-1 text-xl font-semibold ${s.net >= 0 ? 'text-green-700' : 'text-red-700'}`}
            >
              {formatINR(s.net)}
            </p>
          </div>
          <div className="rounded-xl border border-seagreen-light bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Open pending (all)</p>
            <p className="mt-1 text-lg font-semibold text-amber-800">
              {s.open_pending_count} bills · {formatINR(s.open_pending_remaining)}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-seagreen-light bg-seagreen-light/30 p-4">
        <h2 className="mb-3 text-lg font-semibold text-seagreen-dark">Add to ledger</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFlowTab('in');
              setFormError('');
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              flowTab === 'in'
                ? 'bg-green-600 text-white'
                : 'bg-white text-neutral-700 ring-1 ring-neutral-200'
            }`}
          >
            Funds in
          </button>
          <button
            type="button"
            onClick={() => {
              setFlowTab('out');
              setFormError('');
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              flowTab === 'out'
                ? 'bg-red-600 text-white'
                : 'bg-white text-neutral-700 ring-1 ring-neutral-200'
            }`}
          >
            Funds spent
          </button>
        </div>

        {flowTab === 'in' && (
          <>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setInflowTab('partner')}
                className={`rounded-md px-3 py-1 text-sm ${
                  inflowTab === 'partner' ? 'bg-white font-medium shadow' : 'text-neutral-600'
                }`}
              >
                Partner investment
              </button>
              <button
                type="button"
                onClick={() => setInflowTab('external')}
                className={`rounded-md px-3 py-1 text-sm ${
                  inflowTab === 'external' ? 'bg-white font-medium shadow' : 'text-neutral-600'
                }`}
              >
                Borrowed external
              </button>
            </div>
            {inflowTab === 'partner' ? (
              <form onSubmit={submitPartner} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Date</label>
                  <input
                    type="date"
                    value={partnerForm.date}
                    onChange={(e) => setPartnerForm((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Who</label>
                  <select
                    value={partnerForm.partner}
                    onChange={(e) =>
                      setPartnerForm((f) => ({ ...f, partner: e.target.value as InvestmentPartner }))
                    }
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  >
                    {INVESTMENT_PARTNERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={partnerForm.amount}
                    onChange={(e) => setPartnerForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600">Notes (optional)</label>
                  <input
                    type="text"
                    value={partnerForm.description}
                    onChange={(e) => setPartnerForm((f) => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-seagreen px-4 py-2 text-sm text-white hover:bg-seagreen-dark disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitExternal} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Date</label>
                  <input
                    type="date"
                    value={externalForm.date}
                    onChange={(e) => setExternalForm((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Who (name)</label>
                  <input
                    type="text"
                    value={externalForm.external_party_name}
                    onChange={(e) => setExternalForm((f) => ({ ...f, external_party_name: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600">Details</label>
                  <textarea
                    value={externalForm.external_details}
                    onChange={(e) => setExternalForm((f) => ({ ...f, external_details: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    rows={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={externalForm.amount}
                    onChange={(e) => setExternalForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-seagreen px-4 py-2 text-sm text-white hover:bg-seagreen-dark disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {flowTab === 'out' && (
          <form onSubmit={submitExpense} className="space-y-3">
            <p className="text-xs text-neutral-600">
              <strong>Pending (not yet paid):</strong> enter how much is still owed. Leave empty or 0 for{' '}
              <strong>no pending</strong> — the full amount is recorded as spent now. If it equals the total,
              nothing is spent yet and the full amount goes to the pending list.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Expense type</label>
                <input
                  type="text"
                  value={expenseForm.expense_type}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, expense_type: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  placeholder="e.g. Vendor, Legal, Equipment"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Total amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">
                  Pending — not yet paid (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={expenseForm.pending_amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, pending_amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  placeholder="0 = no pending"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-neutral-600">Description</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-seagreen px-4 py-2 text-sm text-white hover:bg-seagreen-dark disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        )}
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-seagreen-dark">Lists &amp; pending</h2>
        <p className="text-sm text-neutral-600">
          Use the controls below to open details. Summaries above always reflect the selected period.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setPendingModalOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Open pending bills. ${openPendingCount} open bills.`}
            className={`max-w-md rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen-dark focus-visible:ring-offset-2 ${
              openPendingCount > 0
                ? 'border-amber-500 bg-amber-100 text-amber-950 shadow-md ring-2 ring-amber-400'
                : 'border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span className="block text-sm font-semibold">Pending bills — open balances</span>
            <span className="mt-1 block text-xs text-amber-900/85">
              {openPendingCount > 0
                ? `${openPendingCount} open — click to record payments or view update history (dialog).`
                : 'No open pending. Click to confirm in dialog.'}
            </span>
          </button>

          {pendingInPeriodCount > 0 && (
            <button
              type="button"
              aria-expanded={pendingPeriodExpanded}
              aria-controls="investment-pending-period-panel"
              onClick={() => setPendingPeriodExpanded((v) => !v)}
              className="max-w-md rounded-xl border border-seagreen-light bg-white px-4 py-3 text-left shadow-sm transition hover:bg-seagreen-light/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen-dark focus-visible:ring-offset-2"
            >
              <span className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-seagreen-dark" aria-hidden>
                  {pendingPeriodExpanded ? '▼' : '▶'}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-seagreen-dark">
                    Bills incurred in this period
                  </span>
                  <span className="mt-1 block text-xs text-neutral-600">
                    {pendingInPeriodCount} bill{pendingInPeriodCount !== 1 ? 's' : ''} with date in range —{' '}
                    <span className="font-medium text-seagreen-dark">
                      {pendingPeriodExpanded ? 'click to hide table' : 'click to show full table'}
                    </span>
                    .
                  </span>
                </span>
              </span>
            </button>
          )}
        </div>

        {pendingPeriodExpanded && pendingInPeriodCount > 0 && data && (
          <div
            id="investment-pending-period-panel"
            role="region"
            aria-label="Bills whose incurred date falls in the selected period"
            className="overflow-x-auto rounded-xl border border-seagreen-light bg-white shadow-sm"
          >
            <p className="border-b border-seagreen-light bg-seagreen-light/40 px-3 py-2 text-xs text-neutral-700">
              Includes open and settled bills dated in this period.
            </p>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                  <th className="px-3 py-2">Incurred</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">History</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingInRange.map((b) => (
                  <tr key={b.id} className="border-b border-neutral-100">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(b.date_incurred)}</td>
                    <td className="px-3 py-2">{b.expense_type}</td>
                    <td className="px-3 py-2 text-neutral-600">{b.description || '—'}</td>
                    <td className="px-3 py-2">{formatINR(b.total_amount)}</td>
                    <td className="px-3 py-2">{formatINR(b.amount_paid)}</td>
                    <td className="px-3 py-2 font-medium text-amber-800">
                      {formatINR(b.amount_remaining)}
                    </td>
                    <td className="px-3 py-2">
                      {b.amount_remaining <= 0 ? (
                        <span className="text-green-700">Settled</span>
                      ) : (
                        <span className="text-amber-800">Open</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          openAudit(`Bill · ${b.expense_type}`, 'pending_bill', b.id)
                        }
                        className="text-seagreen-dark underline hover:text-seagreen focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen"
                      >
                        Updates
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-seagreen-light bg-white shadow-sm">
          <button
            type="button"
            aria-expanded={ledgerExpanded}
            aria-controls="investment-ledger-entries-panel"
            onClick={() => setLedgerExpanded((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-seagreen-light/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seagreen-dark"
          >
            <span className="shrink-0 font-mono text-seagreen-dark" aria-hidden>
              {ledgerExpanded ? '▼' : '▶'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-seagreen-dark">
                Ledger entries for this period
              </span>
              <span className="mt-1 block text-sm text-neutral-600">
                {entryCount === 0
                  ? 'No rows in this period. Expand to see the empty state.'
                  : `${entryCount} row${entryCount !== 1 ? 's' : ''}. Click to ${ledgerExpanded ? 'collapse the table' : 'show the complete list for this period'}.`}
              </span>
            </span>
          </button>

          {ledgerExpanded && (
            <div
              id="investment-ledger-entries-panel"
              role="region"
              aria-label="Investment ledger entries for the selected period"
              className="border-t border-seagreen-light"
            >
              <div className="overflow-x-auto">
                {!data ? (
                  <p className="px-4 py-6 text-sm text-neutral-500">Loading…</p>
                ) : (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-seagreen-light bg-seagreen-light/50">
                      <th className="px-3 py-2 font-medium text-seagreen-dark">Date</th>
                      <th className="px-3 py-2 font-medium text-seagreen-dark">Type</th>
                      <th className="px-3 py-2 font-medium text-seagreen-dark">Detail</th>
                      <th className="px-3 py-2 font-medium text-seagreen-dark">Amount</th>
                      <th className="px-3 py-2 font-medium text-seagreen-dark">History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryCount === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                          No ledger rows in this period.
                        </td>
                      </tr>
                    ) : (
                      data.entries.map((e) => (
                        <tr key={e.id} className="border-b border-neutral-100 hover:bg-seagreen-light/20">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="px-3 py-2">{entryLabel(e)}</td>
                          <td className="px-3 py-2 text-neutral-600">
                            {e.description ||
                              e.external_details ||
                              (e.partner_name ? `—` : '') ||
                              '—'}
                          </td>
                          <td
                            className={`px-3 py-2 font-medium ${
                              e.direction === 'in' ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {e.direction === 'in' ? '+' : '−'}
                            {formatINR(e.amount)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                openAudit(`Ledger line · ${formatDate(e.date)}`, 'ledger_entry', e.id)
                              }
                              className="text-seagreen-dark underline hover:text-seagreen focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setPendingModalOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="pending-title" className="text-lg font-semibold text-seagreen-dark">
                Open pending bills
              </h3>
              <button
                type="button"
                onClick={() => setPendingModalOpen(false)}
                className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-seagreen"
                aria-label="Close pending bills dialog"
              >
                Close
              </button>
            </div>
            {(data?.openPending?.length ?? 0) === 0 ? (
              <p className="text-neutral-500">No open pending bills.</p>
            ) : (
              <ul className="space-y-3">
                {data!.openPending.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-neutral-200 p-3 text-sm"
                  >
                    <p className="font-medium text-seagreen-dark">
                      {b.expense_type} · {formatDate(b.date_incurred)}
                    </p>
                    <p className="text-neutral-600">{b.description || '—'}</p>
                    <p className="mt-1">
                      Remaining:{' '}
                      <span className="font-semibold text-amber-800">
                        {formatINR(b.amount_remaining)}
                      </span>{' '}
                      of {formatINR(b.total_amount)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPayBill(b);
                          setFormError('');
                          setPayForm({
                            date: new Date().toISOString().slice(0, 10),
                            amount: String(b.amount_remaining),
                            paid_by: '',
                            description: '',
                          });
                        }}
                        className="rounded-md bg-seagreen px-3 py-1 text-xs text-white hover:bg-seagreen-dark"
                      >
                        Record payment
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openAudit(`Bill · ${b.expense_type}`, 'pending_bill', b.id)
                        }
                        className="rounded-md border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50"
                      >
                        All updates
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {payBill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-seagreen-dark">Record payment</h3>
            <p className="mt-1 text-sm text-neutral-600">
              {payBill.expense_type} — remaining {formatINR(payBill.amount_remaining)}
            </p>
            <form onSubmit={submitPay} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600">Payment date</label>
                <input
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  max={payBill.amount_remaining}
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Who paid</label>
                <input
                  type="text"
                  value={payForm.paid_by}
                  onChange={(e) => setPayForm((f) => ({ ...f, paid_by: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Description</label>
                <input
                  type="text"
                  value={payForm.description}
                  onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm"
                  placeholder="e.g. First instalment, UTR reference"
                  required
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-seagreen px-4 py-2 text-sm text-white hover:bg-seagreen-dark disabled:opacity-50"
                >
                  Save payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayBill(null);
                    setFormError('');
                  }}
                  className="rounded-md border border-neutral-200 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {auditModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-seagreen-dark">{auditModal.title}</h3>
              <button
                type="button"
                onClick={() => setAuditModal(null)}
                className="text-neutral-500 hover:text-neutral-800"
              >
                Close
              </button>
            </div>
            {auditModal.loading ? (
              <p className="text-neutral-500">Loading…</p>
            ) : !auditModal.rows?.length ? (
              <p className="text-neutral-500">No audit entries.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {auditModal.rows.map((r) => (
                  <li key={r.id} className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3">
                    <p className="text-xs text-neutral-500">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="font-medium text-seagreen-dark">{r.action.replace(/_/g, ' ')}</p>
                    {r.note && <p className="mt-1 text-neutral-700">{r.note}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-600">
                      {r.paid_by && <span>Paid by: {r.paid_by}</span>}
                      {r.amount != null && <span>Amount: {formatINR(r.amount)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
