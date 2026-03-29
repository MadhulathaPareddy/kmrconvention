import { neon } from '@neondatabase/serverless';
import type {
  Event,
  Expenditure,
  ExpenditureDeletion,
  ExpenditureFlow,
  Comment,
  MonthlySummary,
  EventHistoryEntry,
  SummaryRow,
  SummaryWithBreakdown,
  SummaryEventLine,
  LoanAccountEntry,
  LoanAccountEntryKind,
  LoanAccountDashboard,
  InvestmentLedgerEntry,
  InvestmentPendingBill,
  InvestmentLedgerAuditRow,
  InvestmentPartner,
  InvestmentEntryKind,
} from './types';
import { INVESTMENT_PARTNERS } from './types';
import { istYmd } from './ist';

function getSql() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL or DATABASE_URL');
  }
  return neon(connectionString);
}

// Run schema creation once on first use (fixes "relation does not exist" on fresh DB)
let schemaPromise: Promise<void> | null = null;
async function ensureSchemaOnce(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          contact_info VARCHAR(500),
          price INTEGER NOT NULL,
          diesel_included BOOLEAN NOT NULL DEFAULT false,
          diesel_type VARCHAR(10),
          decor_royalty INTEGER NOT NULL DEFAULT 0,
          kitchen_royalty INTEGER NOT NULL DEFAULT 0,
          diesel_amount INTEGER NOT NULL DEFAULT 0,
          diesel_expenditure_suppressed BOOLEAN NOT NULL DEFAULT false,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS expenditures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          amount INTEGER NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          event_id UUID REFERENCES events(id) ON DELETE SET NULL,
          category_other VARCHAR(200),
          flow_type VARCHAR(20) NOT NULL DEFAULT 'expense',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenditures' AND column_name = 'event_id') THEN
            ALTER TABLE expenditures ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenditures' AND column_name = 'category_other') THEN
            ALTER TABLE expenditures ADD COLUMN category_other VARCHAR(200);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenditures' AND column_name = 'flow_type') THEN
            ALTER TABLE expenditures ADD COLUMN flow_type VARCHAR(20) NOT NULL DEFAULT 'expense';
          END IF;
        END $$
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          author_name VARCHAR(200) NOT NULL,
          author_email VARCHAR(255),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'diesel_type') THEN
            ALTER TABLE events ADD COLUMN diesel_type VARCHAR(10);
            UPDATE events SET diesel_type = 'KMR' WHERE diesel_included = true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'diesel_expenditure_suppressed') THEN
            ALTER TABLE events ADD COLUMN diesel_expenditure_suppressed BOOLEAN NOT NULL DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'decor_royalty') THEN
            ALTER TABLE events ADD COLUMN decor_royalty INTEGER NOT NULL DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'kitchen_royalty') THEN
            ALTER TABLE events ADD COLUMN kitchen_royalty INTEGER NOT NULL DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'diesel_amount') THEN
            ALTER TABLE events ADD COLUMN diesel_amount INTEGER NOT NULL DEFAULT 0;
            UPDATE events SET diesel_amount = 30000 WHERE diesel_type IN ('KMR', 'GUEST') OR (diesel_type IS NULL AND diesel_included = true);
          END IF;
        END $$
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS event_deletions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID NOT NULL,
          event_snapshot JSONB NOT NULL,
          expenditures_snapshot JSONB NOT NULL DEFAULT '[]',
          reason TEXT NOT NULL,
          deleted_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS event_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          snapshot_before JSONB NOT NULL,
          changed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'event_history'
              AND column_name = 'change_comment'
          ) THEN
            ALTER TABLE event_history ADD COLUMN change_comment TEXT;
          END IF;
        END $$
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS expenditure_deletions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          expenditure_id UUID NOT NULL,
          snapshot JSONB NOT NULL,
          reason TEXT NOT NULL,
          deleted_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS investment_pending_bills (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date_incurred DATE NOT NULL,
          expense_type VARCHAR(200) NOT NULL,
          description TEXT,
          total_amount INTEGER NOT NULL,
          amount_paid INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS investment_ledger_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          direction VARCHAR(10) NOT NULL,
          entry_kind VARCHAR(40) NOT NULL,
          amount INTEGER NOT NULL,
          partner_name VARCHAR(50),
          external_party_name TEXT,
          external_details TEXT,
          expense_type VARCHAR(200),
          description TEXT,
          pending_bill_id UUID REFERENCES investment_pending_bills(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS investment_ledger_audit (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          ref_type VARCHAR(30) NOT NULL,
          ref_id UUID NOT NULL,
          action VARCHAR(40) NOT NULL,
          note TEXT,
          paid_by VARCHAR(200),
          amount INTEGER
        )
      `;
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'investment_pending_bills'
              AND column_name = 'source_ledger_entry_id'
          ) THEN
            ALTER TABLE investment_pending_bills
            ADD COLUMN source_ledger_entry_id UUID REFERENCES investment_ledger_entries(id) ON DELETE SET NULL;
          END IF;
        END $$
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS investment_pending_bills_one_source_ledger_entry
        ON investment_pending_bills (source_ledger_entry_id)
        WHERE source_ledger_entry_id IS NOT NULL
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS loan_account_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_kind VARCHAR(24) NOT NULL,
          event_id UUID REFERENCES events(id) ON DELETE SET NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      /* Diesel backfill removed from startup: it re-ran on every serverless cold start and
       * re-inserted deleted Diesel rows. Use syncDieselExpenditureForEvent on create/update,
       * or run a one-time SQL migration in the dashboard if needed for legacy data. */
    })();
  }
  await schemaPromise;
}

const AUTO_DIESEL_DESCRIPTION = 'Diesel (included with event)';
const DEFAULT_DIESEL_AMOUNT = 30000;

/** Sync auto-linked Diesel expenditure with event.diesel_amount; respects diesel_expenditure_suppressed. */
async function syncDieselExpenditureForEvent(
  sql: ReturnType<typeof getSql>,
  eventId: string,
  eventDate: string,
  dieselAmount: number,
  hasDieselInclusion: boolean
): Promise<void> {
  const flags = await sql`
    SELECT diesel_expenditure_suppressed FROM events WHERE id = ${eventId}::uuid
  `;
  const fr = (flags as unknown[])[0] as { diesel_expenditure_suppressed?: boolean } | undefined;
  if (fr?.diesel_expenditure_suppressed === true) return;

  await sql`
    DELETE FROM expenditures
    WHERE event_id = ${eventId}::uuid AND category = 'Diesel' AND description = ${AUTO_DIESEL_DESCRIPTION}
  `;

  if (!hasDieselInclusion || dieselAmount <= 0) return;

  await sql`
    INSERT INTO expenditures (date, amount, category, description, event_id, flow_type)
    VALUES (${eventDate}::date, ${dieselAmount}, 'Diesel', ${AUTO_DIESEL_DESCRIPTION}, ${eventId}::uuid, 'expense')
  `;
}

/** Diesel line is best-effort: event row must not fail if this errors (avoids false “failed” after insert). */
async function safeSyncDieselExpenditureForEvent(
  sql: ReturnType<typeof getSql>,
  eventId: string,
  eventDate: string,
  dieselAmount: number,
  hasDieselInclusion: boolean
): Promise<void> {
  try {
    await syncDieselExpenditureForEvent(sql, eventId, eventDate, dieselAmount, hasDieselInclusion);
  } catch (e) {
    console.error('safeSyncDieselExpenditureForEvent: event saved but diesel expenditure sync failed', e);
  }
}

// Neon returns rows array directly; normalize Event with diesel_type (diesel_included = diesel_type != null)
function num(r: Record<string, unknown>, key: string, fallback = 0): number {
  const v = r[key];
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

/** Normalize PG `date` (string or Date from driver) to YYYY-MM-DD for correct comparisons with "today". */
function pgDateToYmd(d: unknown): string {
  if (d == null) return '';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const parsed = new Date(d);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
    }
    return d;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(d);
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m2 ? m2[1] : s;
}

function toEvent(row: Record<string, unknown>): Event {
  const r = row as Record<string, unknown>;
  const diesel_type = (r.diesel_type as string) || null;
  return {
    id: String(r.id),
    date: pgDateToYmd(r.date),
    event_type: String(r.event_type),
    contact_info: r.contact_info != null ? String(r.contact_info) : null,
    price: num(r, 'price'),
    decor_royalty: num(r, 'decor_royalty'),
    kitchen_royalty: num(r, 'kitchen_royalty'),
    diesel_amount: num(r, 'diesel_amount'),
    diesel_included: diesel_type === 'KMR' || diesel_type === 'GUEST',
    diesel_type: diesel_type === 'KMR' || diesel_type === 'GUEST' ? diesel_type : null,
    diesel_expenditure_suppressed: Boolean(r.diesel_expenditure_suppressed),
    notes: r.notes != null ? String(r.notes) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getEvents(from?: string, to?: string): Promise<Event[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, event_type, contact_info, price, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
      FROM events WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date ASC
    `;
    return (Array.isArray(rows) ? rows : []).map((r) => toEvent(r as Record<string, unknown>));
  }
  const rows = await sql`
    SELECT id, date, event_type, contact_info, price, decor_royalty, kitchen_royalty, diesel_amount, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
    FROM events ORDER BY date DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => toEvent(r as Record<string, unknown>));
}

export async function getEventById(id: string): Promise<Event | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, event_type, contact_info, price, decor_royalty, kitchen_royalty, diesel_amount, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
    FROM events WHERE id = ${id}::uuid
  `;
  const row = (rows as unknown[])[0];
  return row ? toEvent(row as Record<string, unknown>) : null;
}

export async function createEvent(data: {
  date: string;
  event_type: string;
  contact_info?: string;
  price: number;
  decor_royalty?: number;
  kitchen_royalty?: number;
  diesel_amount?: number;
  diesel_type?: string | null;
  diesel_included?: boolean;
  notes?: string;
}): Promise<Event> {
  await ensureSchemaOnce();
  const sql = getSql();
  const dieselType = data.diesel_type ?? (data.diesel_included ? 'KMR' : null);
  const hasDiesel = dieselType === 'KMR' || dieselType === 'GUEST';
  const decor = Math.max(0, Number(data.decor_royalty ?? 0) || 0);
  const kitchen = Math.max(0, Number(data.kitchen_royalty ?? 0) || 0);
  let dieselAmt = Math.max(0, Number(data.diesel_amount ?? 0) || 0);
  if (hasDiesel && dieselAmt <= 0) dieselAmt = DEFAULT_DIESEL_AMOUNT;
  if (!hasDiesel) dieselAmt = 0;
  const rows = await sql`
    INSERT INTO events (date, event_type, contact_info, price, decor_royalty, kitchen_royalty, diesel_amount, diesel_type, notes)
    VALUES (${data.date}::date, ${data.event_type}, ${data.contact_info ?? null}, ${data.price}, ${decor}, ${kitchen}, ${dieselAmt}, ${dieselType}, ${data.notes ?? null})
    RETURNING id, date, event_type, contact_info, price, decor_royalty, kitchen_royalty, diesel_amount, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
  `;
  const row = (rows as unknown[])[0];
  const event = row ? toEvent(row as Record<string, unknown>) : null;
  if (event) {
    await safeSyncDieselExpenditureForEvent(sql, event.id, event.date, event.diesel_amount, hasDiesel);
  }
  return event!;
}

const CHANGE_COMMENT_REQUIRED_MSG = 'A short comment explaining this change is required';

export async function updateEvent(
  id: string,
  changeComment: string,
  data: Partial<{
    date: string;
    event_type: string;
    contact_info: string;
    price: number;
    decor_royalty: number;
    kitchen_royalty: number;
    diesel_amount: number;
    diesel_type: string | null;
    diesel_included: boolean;
    notes: string;
  }>
): Promise<Event | null> {
  const trimmedComment = typeof changeComment === 'string' ? changeComment.trim() : '';
  if (!trimmedComment) {
    throw new Error(CHANGE_COMMENT_REQUIRED_MSG);
  }
  const event = await getEventById(id);
  if (!event) return null;
  await ensureSchemaOnce();
  const sql = getSql();
  // Record history (snapshot before update)
  const snapshotBefore = {
    date: event.date,
    event_type: event.event_type,
    contact_info: event.contact_info,
    price: event.price,
    decor_royalty: event.decor_royalty,
    kitchen_royalty: event.kitchen_royalty,
    diesel_amount: event.diesel_amount,
    diesel_type: event.diesel_type,
    diesel_expenditure_suppressed: event.diesel_expenditure_suppressed,
    notes: event.notes,
    updated_at: event.updated_at,
  };
  await sql`
    INSERT INTO event_history (event_id, snapshot_before, change_comment)
    VALUES (${id}::uuid, ${JSON.stringify(snapshotBefore)}::jsonb, ${trimmedComment})
  `;
  const dieselType = data.diesel_type !== undefined ? data.diesel_type : (data.diesel_included ? 'KMR' : event.diesel_type);
  const prevHadDiesel = event.diesel_type === 'KMR' || event.diesel_type === 'GUEST';
  const newHadDiesel = dieselType === 'KMR' || dieselType === 'GUEST';
  let nextSuppressed = event.diesel_expenditure_suppressed;
  if (!prevHadDiesel && newHadDiesel) {
    nextSuppressed = false;
  }
  if (prevHadDiesel && !newHadDiesel) {
    nextSuppressed = false;
  }

  const nextDecor = data.decor_royalty !== undefined ? Math.max(0, Number(data.decor_royalty) || 0) : event.decor_royalty;
  const nextKitchen = data.kitchen_royalty !== undefined ? Math.max(0, Number(data.kitchen_royalty) || 0) : event.kitchen_royalty;
  let nextDieselAmt =
    data.diesel_amount !== undefined ? Math.max(0, Number(data.diesel_amount) || 0) : event.diesel_amount;
  if (newHadDiesel && nextDieselAmt <= 0) nextDieselAmt = DEFAULT_DIESEL_AMOUNT;
  if (!newHadDiesel) nextDieselAmt = 0;

  const rows = await sql`
    UPDATE events SET
      date = COALESCE(${data.date ?? event.date}::date, date),
      event_type = COALESCE(${data.event_type ?? event.event_type}, event_type),
      contact_info = COALESCE(${data.contact_info ?? event.contact_info}, contact_info),
      price = COALESCE(${data.price ?? event.price}, price),
      decor_royalty = ${nextDecor},
      kitchen_royalty = ${nextKitchen},
      diesel_amount = ${nextDieselAmt},
      diesel_type = ${dieselType ?? null},
      diesel_expenditure_suppressed = ${nextSuppressed},
      notes = COALESCE(${data.notes ?? event.notes}, notes),
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, date, event_type, contact_info, price, decor_royalty, kitchen_royalty, diesel_amount, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
  `;
  const row = (rows as unknown[])[0];
  const updated = row ? toEvent(row as Record<string, unknown>) : null;
  if (updated) {
    await safeSyncDieselExpenditureForEvent(
      sql,
      updated.id,
      updated.date,
      updated.diesel_amount,
      newHadDiesel
    );
  }
  return updated;
}

export async function deleteEvent(id: string, reason: string): Promise<boolean> {
  await ensureSchemaOnce();
  const sql = getSql();
  const event = await getEventById(id);
  if (!event) return false;
  const expenditures = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, created_at
    FROM expenditures WHERE event_id = ${id}::uuid
  `;
  const eventSnapshot = {
    id: event.id,
    date: event.date,
    event_type: event.event_type,
    contact_info: event.contact_info,
    price: event.price,
    decor_royalty: event.decor_royalty,
    kitchen_royalty: event.kitchen_royalty,
    diesel_amount: event.diesel_amount,
    diesel_type: event.diesel_type,
    diesel_expenditure_suppressed: event.diesel_expenditure_suppressed,
    notes: event.notes,
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
  await sql`
    INSERT INTO event_deletions (event_id, event_snapshot, expenditures_snapshot, reason)
    VALUES (${id}::uuid, ${JSON.stringify(eventSnapshot)}::jsonb, ${JSON.stringify(Array.isArray(expenditures) ? expenditures : [])}::jsonb, ${reason})
  `;
  const del = await sql`DELETE FROM events WHERE id = ${id}::uuid RETURNING id`;
  return (del as unknown[]).length > 0;
}

export async function getEventHistory(eventId: string): Promise<EventHistoryEntry[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, event_id, snapshot_before, changed_at, change_comment
    FROM event_history WHERE event_id = ${eventId}::uuid
    ORDER BY changed_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      event_id: String(row.event_id),
      snapshot_before: (row.snapshot_before as Record<string, unknown>) || {},
      changed_at: String(row.changed_at),
      change_comment: row.change_comment != null ? String(row.change_comment) : null,
    };
  }) as EventHistoryEntry[];
}

/** Per-event count of update-history rows (for list UI). */
export async function getEventHistoryCounts(): Promise<Map<string, number>> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT event_id::text AS eid, COUNT(*)::int AS c
    FROM event_history
    GROUP BY event_id
  `;
  const m = new Map<string, number>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const row = r as Record<string, unknown>;
    m.set(String(row.eid), Number(row.c) || 0);
  }
  return m;
}

function toExpenditure(row: Record<string, unknown>): Expenditure {
  const r = row as Record<string, unknown>;
  const ft = (r.flow_type as string) || 'expense';
  return {
    id: String(r.id),
    date: pgDateToYmd(r.date),
    amount: Number(r.amount) || 0,
    category: String(r.category ?? ''),
    description: r.description != null ? String(r.description) : null,
    created_at: String(r.created_at),
    event_id: r.event_id != null ? String(r.event_id) : null,
    category_other: r.category_other != null ? String(r.category_other) : null,
    flow_type: ft === 'income' ? 'income' : 'expense',
  };
}

// Expenditures
export async function getExpenditures(from?: string, to?: string): Promise<Expenditure[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, amount, category, description, event_id, category_other, flow_type, created_at
      FROM expenditures WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date DESC
    `;
    return (Array.isArray(rows) ? rows : []).map((r) => toExpenditure(r as Record<string, unknown>));
  }
  const rows = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, flow_type, created_at
    FROM expenditures ORDER BY date DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => toExpenditure(r as Record<string, unknown>));
}

export async function createExpenditure(data: {
  date: string;
  amount: number;
  category: string;
  description?: string;
  event_id?: string | null;
  category_other?: string | null;
  flow_type?: ExpenditureFlow;
}): Promise<Expenditure> {
  await ensureSchemaOnce();
  const sql = getSql();
  const flow: ExpenditureFlow = data.flow_type === 'income' ? 'income' : 'expense';
  const rows = await sql`
    INSERT INTO expenditures (date, amount, category, description, event_id, category_other, flow_type)
    VALUES (${data.date}::date, ${data.amount}, ${data.category}, ${data.description ?? null}, ${data.event_id ?? null}, ${data.category_other ?? null}, ${flow})
    RETURNING id, date, amount, category, description, event_id, category_other, flow_type, created_at
  `;
  const row = (rows as unknown[])[0];
  return toExpenditure(row as Record<string, unknown>);
}

export async function getExpenditureById(id: string): Promise<Expenditure | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, flow_type, created_at
    FROM expenditures WHERE id = ${id}::uuid
  `;
  const arr = rows as unknown[];
  return arr.length > 0 ? toExpenditure(arr[0] as Record<string, unknown>) : null;
}

/** Soft-archive then delete: snapshot + reason in expenditure_deletions. */
export async function deleteExpenditure(id: string, reason: string): Promise<boolean> {
  await ensureSchemaOnce();
  const sql = getSql();
  const row = await getExpenditureById(id);
  if (!row) return false;
  const snapshot = {
    id: row.id,
    date: row.date,
    amount: row.amount,
    category: row.category,
    description: row.description,
    event_id: row.event_id,
    category_other: row.category_other,
    flow_type: row.flow_type,
    created_at: row.created_at,
  };
  await sql`
    INSERT INTO expenditure_deletions (expenditure_id, snapshot, reason)
    VALUES (${id}::uuid, ${JSON.stringify(snapshot)}::jsonb, ${reason})
  `;
  if (
    row.flow_type === 'expense' &&
    row.event_id &&
    row.category === 'Diesel'
  ) {
    await sql`
      UPDATE events SET diesel_expenditure_suppressed = true WHERE id = ${row.event_id}::uuid
    `;
  }
  const del = await sql`
    DELETE FROM expenditures WHERE id = ${id}::uuid RETURNING id
  `;
  return (del as unknown[]).length > 0;
}

export async function getDeletedExpenditures(): Promise<ExpenditureDeletion[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, expenditure_id, snapshot, reason, deleted_at
    FROM expenditure_deletions
    ORDER BY deleted_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      expenditure_id: String(row.expenditure_id),
      snapshot: (row.snapshot as Record<string, unknown>) || {},
      reason: String(row.reason ?? ''),
      deleted_at: String(row.deleted_at),
    };
  });
}
export async function getCommentsByEventId(eventId: string): Promise<Comment[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, event_id, author_name, author_email, content, created_at
    FROM comments WHERE event_id = ${eventId}::uuid ORDER BY created_at ASC
  `;
  return rows as unknown as Comment[];
}

export async function createComment(data: {
  event_id: string;
  author_name: string;
  author_email?: string;
  content: string;
}): Promise<Comment> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO comments (event_id, author_name, author_email, content)
    VALUES (${data.event_id}::uuid, ${data.author_name}, ${data.author_email ?? null}, ${data.content})
    RETURNING id, event_id, author_name, author_email, content, created_at
  `;
  return (rows as unknown as Comment[])[0];
}

/** Tag-linked royalty (income expenditures with event_id); counted toward that event and monthly revenue. */
export async function getTaggedIncomeSumForEvent(eventId: string): Promise<number> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS s
    FROM expenditures
    WHERE event_id = ${eventId}::uuid AND COALESCE(flow_type, 'expense') = 'income'
  `;
  const r = (rows as unknown[])[0] as { s: number } | undefined;
  return r?.s ?? 0;
}

// Monthly aggregates — event booking prices + tag-linked royalty income (by expenditure month); expenses = outflows only
export async function getMonthlySummaries(year?: number): Promise<MonthlySummary[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (year) {
    const rows = await sql`
      WITH all_activity AS (
        SELECT date FROM events WHERE EXTRACT(YEAR FROM date) = ${year}
        UNION ALL
        SELECT date FROM expenditures
        WHERE COALESCE(flow_type, 'expense') = 'expense' AND EXTRACT(YEAR FROM date) = ${year}
        UNION ALL
        SELECT date FROM expenditures
        WHERE COALESCE(flow_type, 'expense') = 'income' AND event_id IS NOT NULL
          AND EXTRACT(YEAR FROM date) = ${year}
      ),
      months AS (
        SELECT DISTINCT date_trunc('month', date) AS month FROM all_activity
      ),
      event_rev AS (
        SELECT date_trunc('month', date) AS month, COUNT(*)::int AS cnt, COALESCE(SUM(price), 0)::bigint AS booking
        FROM events
        WHERE EXTRACT(YEAR FROM date) = ${year}
        GROUP BY 1
      ),
      tagged_income_rev AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0)::bigint AS royalty
        FROM expenditures
        WHERE COALESCE(flow_type, 'expense') = 'income' AND event_id IS NOT NULL
          AND EXTRACT(YEAR FROM date) = ${year}
        GROUP BY 1
      ),
      rev AS (
        SELECT COALESCE(e.month, t.month) AS month,
          COALESCE(e.cnt, 0)::int AS cnt,
          (COALESCE(e.booking, 0) + COALESCE(t.royalty, 0))::bigint AS rev
        FROM event_rev e
        FULL OUTER JOIN tagged_income_rev t ON e.month = t.month
      ),
      exp_out AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0)::bigint AS tot
        FROM expenditures
        WHERE COALESCE(flow_type, 'expense') = 'expense'
          AND EXTRACT(YEAR FROM date) = ${year}
        GROUP BY date_trunc('month', date)
      )
      SELECT
        to_char(m.month, 'YYYY-MM') AS month,
        EXTRACT(YEAR FROM m.month)::int AS year,
        COALESCE(rev.cnt, 0)::int AS event_count,
        COALESCE(rev.rev, 0)::int AS revenue,
        COALESCE(exp_out.tot, 0)::int AS expenditure,
        (COALESCE(rev.rev, 0) - COALESCE(exp_out.tot, 0))::int AS profit
      FROM months m
      LEFT JOIN rev ON rev.month = m.month
      LEFT JOIN exp_out ON exp_out.month = m.month
      ORDER BY m.month DESC
    `;
    return rows as unknown as MonthlySummary[];
  }
  const rows = await sql`
    WITH all_activity AS (
      SELECT date FROM events
      UNION ALL
      SELECT date FROM expenditures WHERE COALESCE(flow_type, 'expense') = 'expense'
      UNION ALL
      SELECT date FROM expenditures
      WHERE COALESCE(flow_type, 'expense') = 'income' AND event_id IS NOT NULL
    ),
    months AS (
      SELECT DISTINCT date_trunc('month', date) AS month FROM all_activity
    ),
    event_rev AS (
      SELECT date_trunc('month', date) AS month, COUNT(*)::int AS cnt, COALESCE(SUM(price), 0)::bigint AS booking
      FROM events
      GROUP BY 1
    ),
    tagged_income_rev AS (
      SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0)::bigint AS royalty
      FROM expenditures
      WHERE COALESCE(flow_type, 'expense') = 'income' AND event_id IS NOT NULL
      GROUP BY 1
    ),
    rev AS (
      SELECT COALESCE(e.month, t.month) AS month,
        COALESCE(e.cnt, 0)::int AS cnt,
        (COALESCE(e.booking, 0) + COALESCE(t.royalty, 0))::bigint AS rev
      FROM event_rev e
      FULL OUTER JOIN tagged_income_rev t ON e.month = t.month
    ),
    exp_out AS (
      SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0)::bigint AS tot
      FROM expenditures
      WHERE COALESCE(flow_type, 'expense') = 'expense'
      GROUP BY date_trunc('month', date)
    )
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      EXTRACT(YEAR FROM m.month)::int AS year,
      COALESCE(rev.cnt, 0)::int AS event_count,
      COALESCE(rev.rev, 0)::int AS revenue,
      COALESCE(exp_out.tot, 0)::int AS expenditure,
      (COALESCE(rev.rev, 0) - COALESCE(exp_out.tot, 0))::int AS profit
    FROM months m
    LEFT JOIN rev ON rev.month = m.month
    LEFT JOIN exp_out ON exp_out.month = m.month
    ORDER BY m.month DESC
  `;
  return rows as unknown as MonthlySummary[];
}

/** Summary for a single date range (day/week/month/custom/all). */
export async function getSummaryByRange(from: string, to: string, periodLabel: string): Promise<SummaryRow> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    WITH ev AS (
      SELECT
        COUNT(*)::int AS event_count,
        COALESCE(SUM(price), 0)::int AS booking
      FROM events WHERE date >= ${from}::date AND date <= ${to}::date
    ),
    tagged AS (
      SELECT COALESCE(SUM(amount), 0)::int AS royalty
      FROM expenditures
      WHERE date >= ${from}::date AND date <= ${to}::date
        AND COALESCE(flow_type, 'expense') = 'income' AND event_id IS NOT NULL
    )
    SELECT ev.event_count, (ev.booking + tagged.royalty)::int AS revenue
    FROM ev CROSS JOIN tagged
  `;
  const rev = (rows as unknown[])[0] as { event_count: number; revenue: number };
  const expRows = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS expenditure
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
    AND COALESCE(flow_type, 'expense') = 'expense'
  `;
  const exp = (expRows as unknown[])[0] as { expenditure: number };
  const event_count = rev?.event_count ?? 0;
  const revenue = rev?.revenue ?? 0;
  const expenditure = exp?.expenditure ?? 0;
  return {
    period_label: periodLabel,
    event_count,
    revenue,
    expenditure,
    profit: revenue - expenditure,
  };
}

/** Sum of expense-type expenditures per event (all dates), for events list. */
export async function getLinkedExpenseTotalsByEvent(): Promise<Map<string, number>> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT event_id::text AS eid, COALESCE(SUM(amount), 0)::int AS total
    FROM expenditures
    WHERE COALESCE(flow_type, 'expense') = 'expense'
      AND event_id IS NOT NULL
    GROUP BY event_id
  `;
  const m = new Map<string, number>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const row = r as Record<string, unknown>;
    m.set(String(row.eid), Number(row.total) || 0);
  }
  return m;
}

/** Active expense lines linked to an event (for modal). */
export async function getExpenseLinesForEvent(eventId: string): Promise<Expenditure[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, flow_type, created_at
    FROM expenditures
    WHERE event_id = ${eventId}::uuid
      AND COALESCE(flow_type, 'expense') = 'expense'
    ORDER BY date DESC, created_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => toExpenditure(r as Record<string, unknown>));
}

export async function getSummaryWithBreakdown(
  from: string,
  to: string,
  periodLabel: string
): Promise<SummaryWithBreakdown> {
  const base = await getSummaryByRange(from, to, periodLabel);
  await ensureSchemaOnce();
  const sql = getSql();

  const evRows = await sql`
    SELECT id, date, event_type, contact_info, price, decor_royalty, kitchen_royalty
    FROM events
    WHERE date >= ${from}::date AND date <= ${to}::date
    ORDER BY date ASC, id ASC
  `;

  const royRows = await sql`
    SELECT event_id::text AS eid, COALESCE(SUM(amount), 0)::int AS s
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
      AND COALESCE(flow_type, 'expense') = 'income'
      AND event_id IS NOT NULL
    GROUP BY event_id
  `;
  const royaltyByEvent = new Map<string, number>();
  for (const r of Array.isArray(royRows) ? royRows : []) {
    const row = r as Record<string, unknown>;
    royaltyByEvent.set(String(row.eid), Number(row.s) || 0);
  }

  const xRows = await sql`
    SELECT event_id::text AS eid, COALESCE(SUM(amount), 0)::int AS s
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
      AND COALESCE(flow_type, 'expense') = 'expense'
      AND event_id IS NOT NULL
    GROUP BY event_id
  `;
  const expenseByEvent = new Map<string, number>();
  for (const r of Array.isArray(xRows) ? xRows : []) {
    const row = r as Record<string, unknown>;
    expenseByEvent.set(String(row.eid), Number(row.s) || 0);
  }

  const unlRows = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS s
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
      AND COALESCE(flow_type, 'expense') = 'expense'
      AND event_id IS NULL
  `;
  const unlinked =
    Number((unlRows as unknown as Record<string, unknown>[])[0]?.s ?? 0) || 0;

  type EvRow = Record<string, unknown>;
  const event_lines: SummaryEventLine[] = (
    Array.isArray(evRows) ? evRows : []
  ).map((raw) => {
    const r = raw as EvRow;
    const id = String(r.id);
    const price = Number(r.price) || 0;
    const decor = Number(r.decor_royalty) || 0;
    const kitchen = Number(r.kitchen_royalty) || 0;
    const tagged = royaltyByEvent.get(id) ?? 0;
    const revenue = price + decor + kitchen + tagged;
    const expenditure = expenseByEvent.get(id) ?? 0;
    return {
      event_id: id,
      date: pgDateToYmd(r.date),
      event_type: String(r.event_type ?? ''),
      contact_info: r.contact_info != null ? String(r.contact_info) : null,
      revenue,
      expenditure,
      profit: revenue - expenditure,
    };
  });

  return {
    ...base,
    event_lines,
    unlinked_expenditure: unlinked,
  };
}

function toLoanAccountEntry(r: Record<string, unknown>): LoanAccountEntry {
  const k = String(r.entry_kind ?? '');
  const entry_kind: LoanAccountEntryKind =
    k === 'emi_payment' ? 'emi_payment' : 'transfer_from_event';
  return {
    id: String(r.id),
    entry_kind,
    event_id: r.event_id != null ? String(r.event_id) : null,
    amount: Number(r.amount) || 0,
    note: String(r.note ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getLoanAccountDashboard(): Promise<LoanAccountDashboard> {
  await ensureSchemaOnce();
  const sql = getSql();
  const today = istYmd();
  const hall = await getSummaryByRange('2000-01-01', today, 'All time');
  const rows = await sql`
    SELECT id, entry_kind, event_id, amount, note, created_at, updated_at
    FROM loan_account_entries
    ORDER BY created_at DESC, id DESC
  `;
  const entries = (Array.isArray(rows) ? rows : []).map((r) =>
    toLoanAccountEntry(r as Record<string, unknown>)
  );
  const tr = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS s
    FROM loan_account_entries
    WHERE entry_kind = 'transfer_from_event'
  `;
  const em = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS s
    FROM loan_account_entries
    WHERE entry_kind = 'emi_payment'
  `;
  const total_transfers_from_events = Number(
    (tr as unknown as { s: number }[])[0]?.s ?? 0
  );
  const total_emi_payments = Number((em as unknown as { s: number }[])[0]?.s ?? 0);
  const loan_balance = total_transfers_from_events - total_emi_payments;
  const other_account_balance = hall.profit - total_transfers_from_events;
  return {
    entries,
    hall_revenue: hall.revenue,
    hall_expenditure: hall.expenditure,
    hall_profit: hall.profit,
    total_transfers_from_events,
    total_emi_payments,
    loan_balance,
    other_account_balance,
  };
}

export async function createLoanAccountEntry(data: {
  entry_kind: LoanAccountEntryKind;
  event_id?: string | null;
  amount: number;
  note: string;
}): Promise<LoanAccountEntry | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const kind = data.entry_kind === 'emi_payment' ? 'emi_payment' : 'transfer_from_event';
  const amt = Math.max(0, Math.floor(Number(data.amount) || 0));
  if (amt <= 0) return null;
  const note = (data.note ?? '').trim() || '—';
  if (kind === 'transfer_from_event') {
    const eid = data.event_id?.trim();
    if (!eid) return null;
    const ev = await getEventById(eid);
    if (!ev) return null;
    const ins = await sql`
      INSERT INTO loan_account_entries (entry_kind, event_id, amount, note)
      VALUES (${kind}, ${eid}::uuid, ${amt}, ${note})
      RETURNING id, entry_kind, event_id, amount, note, created_at, updated_at
    `;
    const row = (ins as unknown[])[0];
    return row ? toLoanAccountEntry(row as Record<string, unknown>) : null;
  }
  const ins = await sql`
    INSERT INTO loan_account_entries (entry_kind, event_id, amount, note)
    VALUES (${kind}, NULL, ${amt}, ${note})
    RETURNING id, entry_kind, event_id, amount, note, created_at, updated_at
  `;
  const row = (ins as unknown[])[0];
  return row ? toLoanAccountEntry(row as Record<string, unknown>) : null;
}

/** @returns null if not found or validation failed */
export async function updateLoanAccountEntry(
  id: string,
  data: {
    entry_kind: LoanAccountEntryKind;
    event_id?: string | null;
    amount: number;
    note: string;
  }
): Promise<LoanAccountEntry | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const existingRows = await sql`
    SELECT id FROM loan_account_entries WHERE id = ${id}::uuid
  `;
  if (!Array.isArray(existingRows) || existingRows.length === 0) return null;
  const kind = data.entry_kind === 'emi_payment' ? 'emi_payment' : 'transfer_from_event';
  const amt = Math.max(0, Math.floor(Number(data.amount) || 0));
  if (amt <= 0) return null;
  const note = (data.note ?? '').trim() || '—';
  if (kind === 'transfer_from_event') {
    const eid = data.event_id?.trim();
    if (!eid) return null;
    const ev = await getEventById(eid);
    if (!ev) return null;
    const upd = await sql`
      UPDATE loan_account_entries
      SET entry_kind = ${kind},
          event_id = ${eid}::uuid,
          amount = ${amt},
          note = ${note},
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, entry_kind, event_id, amount, note, created_at, updated_at
    `;
    const row = (upd as unknown[])[0];
    return row ? toLoanAccountEntry(row as Record<string, unknown>) : null;
  }
  const upd = await sql`
    UPDATE loan_account_entries
    SET entry_kind = ${kind},
        event_id = NULL,
        amount = ${amt},
        note = ${note},
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, entry_kind, event_id, amount, note, created_at, updated_at
  `;
  const row = (upd as unknown[])[0];
  return row ? toLoanAccountEntry(row as Record<string, unknown>) : null;
}

export async function deleteLoanAccountEntry(id: string): Promise<boolean> {
  await ensureSchemaOnce();
  const sql = getSql();
  const del = await sql`DELETE FROM loan_account_entries WHERE id = ${id}::uuid RETURNING id`;
  return (del as unknown[]).length > 0;
}

// --- Investment ledger (admin-only feature; separate from hall expenditures) ---

function toInvestmentLedgerEntry(r: Record<string, unknown>): InvestmentLedgerEntry {
  const k = String(r.entry_kind ?? '');
  const kind = (
    ['partner_investment', 'external_borrow', 'expense', 'pending_payment'].includes(k) ? k : 'expense'
  ) as InvestmentEntryKind;
  return {
    id: String(r.id),
    date: String(r.date),
    direction: r.direction === 'in' ? 'in' : 'out',
    entry_kind: kind,
    amount: num(r, 'amount'),
    partner_name: r.partner_name != null ? String(r.partner_name) : null,
    external_party_name: r.external_party_name != null ? String(r.external_party_name) : null,
    external_details: r.external_details != null ? String(r.external_details) : null,
    expense_type: r.expense_type != null ? String(r.expense_type) : null,
    description: r.description != null ? String(r.description) : null,
    pending_bill_id: r.pending_bill_id != null ? String(r.pending_bill_id) : null,
    created_at: String(r.created_at),
  };
}

function toInvestmentPendingBill(r: Record<string, unknown>): InvestmentPendingBill {
  const total = num(r, 'total_amount');
  const paid = num(r, 'amount_paid');
  return {
    id: String(r.id),
    date_incurred: String(r.date_incurred),
    expense_type: String(r.expense_type ?? ''),
    description: r.description != null ? String(r.description) : null,
    total_amount: total,
    amount_paid: paid,
    amount_remaining: Math.max(0, total - paid),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

async function insertInvestmentAudit(
  sql: ReturnType<typeof getSql>,
  row: {
    ref_type: string;
    ref_id: string;
    action: string;
    note?: string | null;
    paid_by?: string | null;
    amount?: number | null;
  }
): Promise<void> {
  await sql`
    INSERT INTO investment_ledger_audit (ref_type, ref_id, action, note, paid_by, amount)
    VALUES (
      ${row.ref_type},
      ${row.ref_id}::uuid,
      ${row.action},
      ${row.note ?? null},
      ${row.paid_by ?? null},
      ${row.amount ?? null}
    )
  `;
}

export function isValidInvestmentPartner(p: string): p is InvestmentPartner {
  return (INVESTMENT_PARTNERS as readonly string[]).includes(p);
}

export async function getInvestmentLedgerEntryById(id: string): Promise<InvestmentLedgerEntry | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, direction, entry_kind, amount, partner_name, external_party_name,
           external_details, expense_type, description, pending_bill_id, created_at
    FROM investment_ledger_entries WHERE id = ${id}::uuid
  `;
  const arr = rows as unknown[];
  return arr.length > 0 ? toInvestmentLedgerEntry(arr[0] as Record<string, unknown>) : null;
}

/** Pending bill linked to a funds-spent (expense) row, if any. */
export async function getInvestmentLinkedPendingBillForExpense(
  expenseLedgerEntryId: string
): Promise<InvestmentPendingBill | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    FROM investment_pending_bills
    WHERE source_ledger_entry_id = ${expenseLedgerEntryId}::uuid
    LIMIT 1
  `;
  const arr = rows as unknown[];
  return arr.length > 0 ? toInvestmentPendingBill(arr[0] as Record<string, unknown>) : null;
}

async function syncExpenseLinkedPendingFromEdit(
  sql: ReturnType<typeof getSql>,
  expenseEntryId: string,
  opts: {
    date_incurred: string;
    expense_type: string;
    description: string;
    pending_remaining: number;
    auditNote: string;
  }
): Promise<void> {
  const remaining = Math.max(0, Math.floor(Number(opts.pending_remaining) || 0));
  const existingRows = await sql`
    SELECT id, total_amount, amount_paid
    FROM investment_pending_bills
    WHERE source_ledger_entry_id = ${expenseEntryId}::uuid
    LIMIT 1
  `;
  const existingArr = existingRows as unknown[];
  const existing = existingArr.length > 0 ? (existingArr[0] as Record<string, unknown>) : null;

  if (remaining === 0) {
    if (!existing) return;
    const paid = num(existing, 'amount_paid');
    if (paid > 0) {
      throw new Error(
        `This expense has a linked bill with payments (₹${paid} recorded). You cannot clear pending until remaining is settled or adjusted via payments.`
      );
    }
    const bid = String(existing.id);
    await sql`DELETE FROM investment_pending_bills WHERE id = ${bid}::uuid`;
    await insertInvestmentAudit(sql, {
      ref_type: 'pending_bill',
      ref_id: bid,
      action: 'delete_pending_bill',
      note: opts.auditNote,
    });
    return;
  }

  const paid = existing ? num(existing, 'amount_paid') : 0;
  const newTotal = paid + remaining;
  if (newTotal < paid) throw new Error('Invalid pending remaining');

  if (existing) {
    const bid = String(existing.id);
    await sql`
      UPDATE investment_pending_bills SET
        date_incurred = ${opts.date_incurred}::date,
        expense_type = ${opts.expense_type.trim()},
        description = ${opts.description.trim()},
        total_amount = ${newTotal},
        updated_at = NOW()
      WHERE id = ${bid}::uuid
    `;
    await insertInvestmentAudit(sql, {
      ref_type: 'pending_bill',
      ref_id: bid,
      action: 'edit_pending_bill',
      note: `${opts.auditNote} (open remaining ₹${remaining}; bill total ₹${newTotal})`,
      amount: remaining,
    });
  } else {
    const billRows = await sql`
      INSERT INTO investment_pending_bills (
        date_incurred, expense_type, description, total_amount, amount_paid, source_ledger_entry_id
      )
      VALUES (
        ${opts.date_incurred}::date,
        ${opts.expense_type.trim()},
        ${opts.description.trim()},
        ${remaining},
        0,
        ${expenseEntryId}::uuid
      )
      RETURNING id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    `;
    const bill = toInvestmentPendingBill((billRows as unknown[])[0] as Record<string, unknown>);
    await insertInvestmentAudit(sql, {
      ref_type: 'pending_bill',
      ref_id: bill.id,
      action: 'create_pending_bill',
      note: `${opts.auditNote} (linked on edit; open ₹${remaining})`,
      amount: remaining,
    });
  }
}

export async function updateInvestmentLedgerEntry(
  id: string,
  data: {
    date: string;
    amount: number;
    description?: string | null;
    partner_name?: string | null;
    external_party_name?: string | null;
    external_details?: string | null;
    expense_type?: string | null;
    /** Open balance still owed on linked bill; omit to leave pending unchanged (expense rows only). */
    pending_remaining?: number;
  },
  editComment: string
): Promise<InvestmentLedgerEntry | null> {
  const trimmedComment = editComment?.trim() ?? '';
  if (!trimmedComment) {
    throw new Error('Comment is required when editing a ledger entry');
  }
  await ensureSchemaOnce();
  const sql = getSql();
  const existing = await getInvestmentLedgerEntryById(id);
  if (!existing) return null;

  const amount = Math.max(0, Math.floor(Number(data.amount) || 0));
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const date = data.date?.trim() || existing.date;
  let partner_name = existing.partner_name;
  let external_party_name = existing.external_party_name;
  let external_details = existing.external_details;
  let expense_type = existing.expense_type;
  let description = existing.description;

  const kind = existing.entry_kind;
  if (kind === 'partner_investment') {
    const p = data.partner_name != null ? String(data.partner_name).trim() : existing.partner_name;
    if (!p || !isValidInvestmentPartner(p)) {
      throw new Error('Valid partner is required');
    }
    partner_name = p;
    description = data.description !== undefined ? (data.description?.trim() || null) : existing.description;
  } else if (kind === 'external_borrow') {
    const name = (data.external_party_name ?? existing.external_party_name ?? '').trim();
    const det = (data.external_details ?? existing.external_details ?? '').trim();
    if (!name || !det) throw new Error('External party name and details are required');
    external_party_name = name;
    external_details = det;
    description = det;
  } else if (kind === 'expense' || kind === 'pending_payment') {
    const et = (data.expense_type ?? existing.expense_type ?? '').trim();
    if (!et) throw new Error('Expense type is required');
    expense_type = et;
    const desc = data.description !== undefined ? data.description?.trim() || null : existing.description;
    if (!desc) throw new Error('Description is required');
    description = desc;
  }

  await sql`
    UPDATE investment_ledger_entries SET
      date = ${date}::date,
      amount = ${amount},
      partner_name = ${partner_name},
      external_party_name = ${external_party_name},
      external_details = ${external_details},
      expense_type = ${expense_type},
      description = ${description}
    WHERE id = ${id}::uuid
  `;

  const summaryParts = [
    `date ${existing.date} → ${date}`,
    `amount ₹${existing.amount} → ₹${amount}`,
  ];
  if (kind === 'partner_investment') {
    summaryParts.push(`partner ${existing.partner_name ?? '—'} → ${partner_name}`);
  }
  await insertInvestmentAudit(sql, {
    ref_type: 'ledger_entry',
    ref_id: id,
    action: 'edit_ledger_entry',
    note: `${trimmedComment}\n\n(${summaryParts.join('; ')})`,
    amount,
  });

  if (kind === 'expense' && data.pending_remaining !== undefined) {
    await syncExpenseLinkedPendingFromEdit(sql, id, {
      date_incurred: date,
      expense_type: expense_type ?? '',
      description: description ?? '',
      pending_remaining: data.pending_remaining,
      auditNote: trimmedComment,
    });
  }

  return getInvestmentLedgerEntryById(id);
}

export async function getInvestmentLedgerEntries(
  from?: string,
  to?: string
): Promise<InvestmentLedgerEntry[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, direction, entry_kind, amount, partner_name, external_party_name,
             external_details, expense_type, description, pending_bill_id, created_at
      FROM investment_ledger_entries
      WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date DESC, created_at DESC
    `;
    return (Array.isArray(rows) ? rows : []).map((r) =>
      toInvestmentLedgerEntry(r as Record<string, unknown>)
    );
  }
  const rows = await sql`
    SELECT id, date, direction, entry_kind, amount, partner_name, external_party_name,
           external_details, expense_type, description, pending_bill_id, created_at
    FROM investment_ledger_entries
    ORDER BY date DESC, created_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) =>
    toInvestmentLedgerEntry(r as Record<string, unknown>)
  );
}

/** All bills that still have a balance (for modal + global obligations). */
export async function getInvestmentOpenPendingBills(): Promise<InvestmentPendingBill[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    FROM investment_pending_bills
    WHERE amount_paid < total_amount
    ORDER BY date_incurred DESC, created_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) =>
    toInvestmentPendingBill(r as Record<string, unknown>)
  );
}

export async function getInvestmentPendingBillsInRange(
  from: string,
  to: string
): Promise<InvestmentPendingBill[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    FROM investment_pending_bills
    WHERE date_incurred >= ${from}::date AND date_incurred <= ${to}::date
    ORDER BY date_incurred DESC, created_at DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) =>
    toInvestmentPendingBill(r as Record<string, unknown>)
  );
}

export async function getInvestmentAuditLog(
  refType: string,
  refId: string
): Promise<InvestmentLedgerAuditRow[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, created_at, ref_type, ref_id, action, note, paid_by, amount
    FROM investment_ledger_audit
    WHERE ref_type = ${refType} AND ref_id = ${refId}::uuid
    ORDER BY created_at ASC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      created_at: String(row.created_at),
      ref_type: String(row.ref_type ?? ''),
      ref_id: String(row.ref_id),
      action: String(row.action ?? ''),
      note: row.note != null ? String(row.note) : null,
      paid_by: row.paid_by != null ? String(row.paid_by) : null,
      amount: row.amount != null ? Number(row.amount) : null,
    };
  });
}

export async function createInvestmentPartnerIn(data: {
  date: string;
  partner: InvestmentPartner;
  amount: number;
  description?: string | null;
}): Promise<InvestmentLedgerEntry> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO investment_ledger_entries (
      date, direction, entry_kind, amount, partner_name, description
    )
    VALUES (
      ${data.date}::date, 'in', 'partner_investment', ${data.amount},
      ${data.partner}, ${data.description ?? null}
    )
    RETURNING id, date, direction, entry_kind, amount, partner_name, external_party_name,
              external_details, expense_type, description, pending_bill_id, created_at
  `;
  const entry = toInvestmentLedgerEntry((rows as unknown[])[0] as Record<string, unknown>);
  await insertInvestmentAudit(sql, {
    ref_type: 'ledger_entry',
    ref_id: entry.id,
    action: 'create_partner_investment',
    note: data.description ?? `Partner ${data.partner} — ₹${data.amount}`,
    amount: data.amount,
  });
  return entry;
}

export async function createInvestmentExternalBorrowIn(data: {
  date: string;
  external_party_name: string;
  external_details: string;
  amount: number;
}): Promise<InvestmentLedgerEntry> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO investment_ledger_entries (
      date, direction, entry_kind, amount, external_party_name, external_details, description
    )
    VALUES (
      ${data.date}::date, 'in', 'external_borrow', ${data.amount},
      ${data.external_party_name.trim()}, ${data.external_details.trim()},
      ${data.external_details.trim()}
    )
    RETURNING id, date, direction, entry_kind, amount, partner_name, external_party_name,
              external_details, expense_type, description, pending_bill_id, created_at
  `;
  const entry = toInvestmentLedgerEntry((rows as unknown[])[0] as Record<string, unknown>);
  await insertInvestmentAudit(sql, {
    ref_type: 'ledger_entry',
    ref_id: entry.id,
    action: 'create_external_borrow',
    note: `${data.external_party_name.trim()}: ${data.external_details.trim()}`,
    amount: data.amount,
  });
  return entry;
}

/** `pending_amount` = portion not yet paid (0 = no pending; full amount booked as spent). */
export async function createInvestmentExpense(data: {
  date: string;
  expense_type: string;
  description: string;
  amount: number;
  pending_amount: number;
}): Promise<{ entries?: InvestmentLedgerEntry[]; pending_bill?: InvestmentPendingBill }> {
  await ensureSchemaOnce();
  const sql = getSql();
  const total = Math.max(0, Math.floor(Number(data.amount) || 0));
  const pending = Math.max(0, Math.floor(Number(data.pending_amount) || 0));
  if (total <= 0) throw new Error('Amount must be positive');
  if (pending > total) throw new Error('Pending amount cannot exceed total');
  const immediate = total - pending;
  const entries: InvestmentLedgerEntry[] = [];

  if (immediate > 0) {
    const rows = await sql`
      INSERT INTO investment_ledger_entries (
        date, direction, entry_kind, amount, expense_type, description
      )
      VALUES (
        ${data.date}::date, 'out', 'expense', ${immediate},
        ${data.expense_type.trim()},
        ${pending > 0 ? `${data.description.trim()} (paid portion ₹${immediate} of ₹${total})` : data.description.trim()}
      )
      RETURNING id, date, direction, entry_kind, amount, partner_name, external_party_name,
                external_details, expense_type, description, pending_bill_id, created_at
    `;
    const entry = toInvestmentLedgerEntry((rows as unknown[])[0] as Record<string, unknown>);
    entries.push(entry);
    await insertInvestmentAudit(sql, {
      ref_type: 'ledger_entry',
      ref_id: entry.id,
      action: 'create_expense',
      note: `${data.expense_type}: ${data.description} — spent now ₹${immediate}`,
      amount: immediate,
    });
  }

  if (pending > 0) {
    const sourceId =
      entries.length > 0 ? entries[entries.length - 1]!.id : null;
    const billRows = sourceId
      ? await sql`
          INSERT INTO investment_pending_bills (
            date_incurred, expense_type, description, total_amount, amount_paid, source_ledger_entry_id
          )
          VALUES (
            ${data.date}::date,
            ${data.expense_type.trim()},
            ${data.description.trim()},
            ${pending},
            0,
            ${sourceId}::uuid
          )
          RETURNING id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
        `
      : await sql`
          INSERT INTO investment_pending_bills (date_incurred, expense_type, description, total_amount, amount_paid)
          VALUES (
            ${data.date}::date,
            ${data.expense_type.trim()},
            ${data.description.trim()},
            ${pending},
            0
          )
          RETURNING id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
        `;
    const bill = toInvestmentPendingBill((billRows as unknown[])[0] as Record<string, unknown>);
    await insertInvestmentAudit(sql, {
      ref_type: 'pending_bill',
      ref_id: bill.id,
      action: 'create_pending_bill',
      note: `${data.expense_type}: ${data.description} (pending ₹${pending}${immediate > 0 ? ` of total ₹${total}` : ''})`,
      amount: pending,
    });
    return { entries: entries.length ? entries : undefined, pending_bill: bill };
  }

  return { entries: entries.length ? entries : undefined };
}

export async function payInvestmentPendingBill(data: {
  pending_bill_id: string;
  date: string;
  amount: number;
  paid_by: string;
  description: string;
}): Promise<{ entry: InvestmentLedgerEntry; bill: InvestmentPendingBill }> {
  await ensureSchemaOnce();
  const sql = getSql();
  const existing = await sql`
    SELECT id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    FROM investment_pending_bills WHERE id = ${data.pending_bill_id}::uuid
  `;
  const arr = existing as unknown[];
  if (arr.length === 0) {
    throw new Error('Pending bill not found');
  }
  const billRow = arr[0] as Record<string, unknown>;
  const total = num(billRow, 'total_amount');
  const paid = num(billRow, 'amount_paid');
  const remaining = total - paid;
  if (data.amount <= 0) throw new Error('Amount must be positive');
  if (data.amount > remaining) {
    throw new Error(`Payment exceeds remaining balance (₹${remaining})`);
  }
  const newPaid = paid + data.amount;
  const rows = await sql`
    INSERT INTO investment_ledger_entries (
      date, direction, entry_kind, amount, expense_type, description, pending_bill_id
    )
    VALUES (
      ${data.date}::date, 'out', 'pending_payment', ${data.amount},
      'Pending bill payment',
      ${data.description.trim()},
      ${data.pending_bill_id}::uuid
    )
    RETURNING id, date, direction, entry_kind, amount, partner_name, external_party_name,
              external_details, expense_type, description, pending_bill_id, created_at
  `;
  const entry = toInvestmentLedgerEntry((rows as unknown[])[0] as Record<string, unknown>);
  await sql`
    UPDATE investment_pending_bills
    SET amount_paid = ${newPaid}, updated_at = NOW()
    WHERE id = ${data.pending_bill_id}::uuid
  `;
  await insertInvestmentAudit(sql, {
    ref_type: 'pending_bill',
    ref_id: data.pending_bill_id,
    action: 'record_payment',
    note: data.description.trim(),
    paid_by: data.paid_by.trim(),
    amount: data.amount,
  });
  await insertInvestmentAudit(sql, {
    ref_type: 'ledger_entry',
    ref_id: entry.id,
    action: 'pending_payment_out',
    note: `Toward bill: ${data.description.trim()} (paid by ${data.paid_by.trim()})`,
    paid_by: data.paid_by.trim(),
    amount: data.amount,
  });
  const after = await sql`
    SELECT id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
    FROM investment_pending_bills WHERE id = ${data.pending_bill_id}::uuid
  `;
  const afterArr = after as unknown[];
  if (afterArr.length === 0) throw new Error('Pending bill missing after update');
  const bill = toInvestmentPendingBill(afterArr[0] as Record<string, unknown>);
  return { entry, bill };
}

/**
 * Add an open pending bill linked to an existing funds-spent (expense) ledger line.
 * Does not alter the expense row; creates a new row in investment_pending_bills.
 */
export async function createInvestmentPendingFromExpenseLedger(data: {
  ledger_entry_id: string;
  date_incurred: string;
  pending_amount: number;
}): Promise<InvestmentPendingBill> {
  await ensureSchemaOnce();
  const sql = getSql();
  const entry = await getInvestmentLedgerEntryById(data.ledger_entry_id);
  if (!entry || entry.entry_kind !== 'expense' || entry.direction !== 'out') {
    throw new Error('Choose a funds spent (expense) line from the list');
  }
  const pending = Math.max(0, Math.floor(Number(data.pending_amount) || 0));
  if (pending <= 0) throw new Error('Pending amount must be greater than 0');
  const dateInc = data.date_incurred?.trim() || entry.date;
  const expense_type = entry.expense_type?.trim() || 'Expense';
  let description = entry.description?.trim() || null;
  if (description) {
    description =
      description.replace(/\s*\(paid portion ₹[\d,]+ of ₹[\d,]+\)\s*$/i, '').trim() || null;
  }
  const dup = await sql`
    SELECT id FROM investment_pending_bills
    WHERE source_ledger_entry_id = ${data.ledger_entry_id}::uuid
    LIMIT 1
  `;
  if ((dup as unknown[]).length > 0) {
    throw new Error(
      'This expense already has a linked pending bill. Edit the ledger line to change open pending.'
    );
  }
  const billRows = await sql`
    INSERT INTO investment_pending_bills (
      date_incurred, expense_type, description, total_amount, amount_paid, source_ledger_entry_id
    )
    VALUES (
      ${dateInc}::date,
      ${expense_type},
      ${description},
      ${pending},
      0,
      ${data.ledger_entry_id}::uuid
    )
    RETURNING id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
  `;
  const bill = toInvestmentPendingBill((billRows as unknown[])[0] as Record<string, unknown>);
  await insertInvestmentAudit(sql, {
    ref_type: 'pending_bill',
    ref_id: bill.id,
    action: 'create_pending_from_expense',
    note: `Linked to expense line ${entry.date} · ${expense_type} · recorded spent ₹${entry.amount}; new pending ₹${pending}`,
    amount: pending,
  });
  await insertInvestmentAudit(sql, {
    ref_type: 'ledger_entry',
    ref_id: entry.id,
    action: 'pending_bill_added',
    note: `Pending to pay ₹${pending} (bill ${bill.id.slice(0, 8)}…)`,
    amount: pending,
  });
  return bill;
}

/** Open pending bill with no new expense ledger line (obligation only). */
export async function createInvestmentStandalonePendingBill(data: {
  date_incurred: string;
  expense_type: string;
  description: string;
  total_amount: number;
}): Promise<InvestmentPendingBill> {
  await ensureSchemaOnce();
  const sql = getSql();
  const total = Math.max(0, Math.floor(Number(data.total_amount) || 0));
  if (total <= 0) throw new Error('Amount must be greater than 0');
  const et = data.expense_type?.trim() || '';
  if (!et) throw new Error('Expense type is required');
  const desc = data.description?.trim() || '';
  if (!desc) throw new Error('Description is required');
  const dateInc = data.date_incurred?.trim() || '';
  if (!dateInc) throw new Error('Date is required');
  const billRows = await sql`
    INSERT INTO investment_pending_bills (date_incurred, expense_type, description, total_amount, amount_paid)
    VALUES (
      ${dateInc}::date,
      ${et},
      ${desc},
      ${total},
      0
    )
    RETURNING id, date_incurred, expense_type, description, total_amount, amount_paid, created_at, updated_at
  `;
  const bill = toInvestmentPendingBill((billRows as unknown[])[0] as Record<string, unknown>);
  await insertInvestmentAudit(sql, {
    ref_type: 'pending_bill',
    ref_id: bill.id,
    action: 'create_pending_standalone',
    note: `${et}: ${desc} (standalone pending ₹${total})`,
    amount: total,
  });
  return bill;
}

// Ensure tables exist (idempotent) — also used by POST /api/init
export async function ensureSchema(): Promise<void> {
  await ensureSchemaOnce();
}
