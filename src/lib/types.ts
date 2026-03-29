export type EventType = 'Marriage' | 'Reception' | 'Birthday' | 'Corporate' | 'Other';

/** Incl_Diesel: KMR (red) or GUEST (green). null = not included. */
export type DieselType = 'KMR' | 'GUEST' | null;

export interface Event {
  id: string;
  date: string;
  event_type: EventType | string;
  contact_info: string | null;
  price: number;
  decor_royalty: number;
  kitchen_royalty: number;
  /** Diesel cost for this event (used for linked Diesel expenditure when Incl_Diesel is set). */
  diesel_amount: number;
  /** @deprecated use diesel_type */
  diesel_included?: boolean;
  diesel_type: DieselType;
  /** When true, auto Diesel expenditure is not re-created (admin removed it). */
  diesel_expenditure_suppressed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const DIESEL_OPTIONS: { value: DieselType; label: string }[] = [
  { value: null, label: '—' },
  { value: 'KMR', label: 'KMR' },
  { value: 'GUEST', label: 'GUEST' },
];

export interface EventDeletion {
  id: string;
  event_id: string;
  event_snapshot: Record<string, unknown>;
  expenditures_snapshot: unknown[];
  reason: string;
  deleted_at: string;
}

export interface EventHistoryEntry {
  id: string;
  event_id: string;
  snapshot_before: Record<string, unknown>;
  changed_at: string;
  /** Admin note explaining why the update was made (required on new edits). */
  change_comment: string | null;
}

export type ExpenditureFlow = 'expense' | 'income';

export interface Expenditure {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
  event_id: string | null;
  category_other: string | null;
  /** expense = funds removed; income = investment / royalty added to funds */
  flow_type: ExpenditureFlow;
}

/** Row stored when an expenditure is deleted (admin reason + snapshot). */
export interface ExpenditureDeletion {
  id: string;
  expenditure_id: string;
  snapshot: Record<string, unknown>;
  reason: string;
  deleted_at: string;
}

export interface Comment {
  id: string;
  event_id: string;
  author_name: string;
  author_email: string | null;
  content: string;
  created_at: string;
}

export type ExpenditureCategory =
  | 'Diesel'
  | 'Maintenance'
  | 'Staff'
  | 'Utilities'
  | 'Catering'
  | 'Cleaning'
  | 'Security'
  | 'Supplies'
  | 'Decoration'
  | 'Other';

export const EXPENDITURE_CATEGORIES: ExpenditureCategory[] = [
  'Diesel',
  'Maintenance',
  'Staff',
  'Utilities',
  'Catering',
  'Cleaning',
  'Security',
  'Supplies',
  'Decoration',
  'Other',
];

/** Royalty and other inflows recorded under expenditures (not event booking revenue). */
export type IncomeCategory = 'Royalty — Decor' | 'Royalty — Kitchen' | 'Other';

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Royalty — Decor',
  'Royalty — Kitchen',
  'Other',
];

export const EVENT_TYPES: EventType[] = ['Marriage', 'Reception', 'Birthday', 'Corporate', 'Other'];

/** Equity partners for investment ledger (funds in). */
export const INVESTMENT_PARTNERS = ['Dinesh', 'Shashi', 'Santhosh', 'Bharath'] as const;
export type InvestmentPartner = (typeof INVESTMENT_PARTNERS)[number];

export type InvestmentEntryKind =
  | 'partner_investment'
  | 'external_borrow'
  | 'expense'
  | 'pending_payment';

export interface InvestmentLedgerEntry {
  id: string;
  date: string;
  direction: 'in' | 'out';
  entry_kind: InvestmentEntryKind;
  amount: number;
  partner_name: string | null;
  external_party_name: string | null;
  external_details: string | null;
  expense_type: string | null;
  description: string | null;
  pending_bill_id: string | null;
  created_at: string;
}

export interface InvestmentPendingBill {
  id: string;
  date_incurred: string;
  expense_type: string;
  description: string | null;
  total_amount: number;
  amount_paid: number;
  amount_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface InvestmentLedgerAuditRow {
  id: string;
  created_at: string;
  ref_type: string;
  ref_id: string;
  action: string;
  note: string | null;
  paid_by: string | null;
  amount: number | null;
}

export interface MonthlySummary {
  month: string;
  year: number;
  event_count: number;
  /** Booking prices in month + income expenditures tagged to an event (by line date). */
  revenue: number;
  /** Sum of expense-type expenditures only */
  expenditure: number;
  /** Revenue − expenditure */
  profit: number;
}

/** Single-row summary for a day/week/month/custom/all range (admin /summary). */
export interface SummaryRow {
  period_label: string;
  event_count: number;
  revenue: number;
  expenditure: number;
  profit: number;
}

/** One booking row inside a summary period (event date in range). */
export interface SummaryEventLine {
  event_id: string;
  date: string;
  event_type: string;
  contact_info: string | null;
  /** price + decor + kitchen + tagged royalty (income lines tied to event, dated in range). */
  revenue: number;
  /** Sum of expense-type expenditures linked to this event, dated in range. */
  expenditure: number;
  profit: number;
}

/** Summary totals plus per-event breakdown and unlinked spend in range. */
export interface SummaryWithBreakdown extends SummaryRow {
  event_lines: SummaryEventLine[];
  /** Expense rows in range with no event link. */
  unlinked_expenditure: number;
}
