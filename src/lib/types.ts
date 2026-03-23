export type EventType = 'Marriage' | 'Reception' | 'Birthday' | 'Corporate' | 'Other';

/** Incl_Diesel: KMR (red) or GUEST (green). null = not included. */
export type DieselType = 'KMR' | 'GUEST' | null;

export interface Event {
  id: string;
  date: string;
  event_type: EventType | string;
  contact_info: string | null;
  price: number;
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
}

export interface Expenditure {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
  event_id: string | null;
  category_other: string | null;
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

export const EVENT_TYPES: EventType[] = ['Marriage', 'Reception', 'Birthday', 'Corporate', 'Other'];

export interface MonthlySummary {
  month: string;
  year: number;
  event_count: number;
  revenue: number;
  expenditure: number;
  profit: number;
}

/** For configurable summary: single row for a period (day/week/month/custom/all). */
export interface SummaryRow {
  period_label: string;
  event_count: number;
  revenue: number;
  expenditure: number;
  profit: number;
}
