export type EventType = 'Marriage' | 'Reception' | 'Birthday' | 'Corporate' | 'Other';

export interface Event {
  id: string;
  date: string;
  event_type: EventType | string;
  contact_info: string | null;
  price: number;
  diesel_included: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
