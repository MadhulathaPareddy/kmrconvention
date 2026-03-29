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
} from './types';

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
        CREATE TABLE IF NOT EXISTS expenditure_deletions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          expenditure_id UUID NOT NULL,
          snapshot JSONB NOT NULL,
          reason TEXT NOT NULL,
          deleted_at TIMESTAMPTZ DEFAULT NOW()
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

// Neon returns rows array directly; normalize Event with diesel_type (diesel_included = diesel_type != null)
function num(r: Record<string, unknown>, key: string, fallback = 0): number {
  const v = r[key];
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function toEvent(row: Record<string, unknown>): Event {
  const r = row as Record<string, unknown>;
  const diesel_type = (r.diesel_type as string) || null;
  return {
    id: String(r.id),
    date: String(r.date),
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
    await syncDieselExpenditureForEvent(sql, event.id, event.date, event.diesel_amount, hasDiesel);
  }
  return event!;
}

export async function updateEvent(
  id: string,
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
    INSERT INTO event_history (event_id, snapshot_before)
    VALUES (${id}::uuid, ${JSON.stringify(snapshotBefore)}::jsonb)
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
    await syncDieselExpenditureForEvent(
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
    SELECT id, event_id, snapshot_before, changed_at
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
    };
  }) as EventHistoryEntry[];
}

function toExpenditure(row: Record<string, unknown>): Expenditure {
  const r = row as Record<string, unknown>;
  const ft = (r.flow_type as string) || 'expense';
  return {
    id: String(r.id),
    date: String(r.date),
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

// Monthly aggregates
export async function getMonthlySummaries(year?: number): Promise<MonthlySummary[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (year) {
    const rows = await sql`
      WITH rev AS (
        SELECT date_trunc('month', date) AS month, COUNT(*) AS cnt, COALESCE(SUM(price), 0) AS rev
        FROM events GROUP BY date_trunc('month', date)
      ),
      exp_out AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
        FROM expenditures
        WHERE COALESCE(flow_type, 'expense') = 'expense'
        GROUP BY date_trunc('month', date)
      ),
      exp_in AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
        FROM expenditures
        WHERE flow_type = 'income'
        GROUP BY date_trunc('month', date)
      )
      SELECT
        to_char(rev.month, 'YYYY-MM') AS month,
        EXTRACT(YEAR FROM rev.month)::int AS year,
        rev.cnt::int AS event_count,
        rev.rev::int AS revenue,
        COALESCE(exp_out.tot, 0)::int AS expenditure,
        COALESCE(exp_in.tot, 0)::int AS fund_inflow,
        (rev.rev - COALESCE(exp_out.tot, 0))::int AS profit
      FROM rev
      LEFT JOIN exp_out ON exp_out.month = rev.month
      LEFT JOIN exp_in ON exp_in.month = rev.month
      WHERE date_trunc('year', rev.month) = ${`${year}-01-01`}::date
      ORDER BY rev.month DESC
    `;
    return rows as unknown as MonthlySummary[];
  }
  const rows = await sql`
    WITH rev AS (
      SELECT date_trunc('month', date) AS month, COUNT(*) AS cnt, COALESCE(SUM(price), 0) AS rev
      FROM events GROUP BY date_trunc('month', date)
    ),
    exp_out AS (
      SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
      FROM expenditures
      WHERE COALESCE(flow_type, 'expense') = 'expense'
      GROUP BY date_trunc('month', date)
    ),
    exp_in AS (
      SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
      FROM expenditures
      WHERE flow_type = 'income'
      GROUP BY date_trunc('month', date)
    )
    SELECT
      to_char(rev.month, 'YYYY-MM') AS month,
      EXTRACT(YEAR FROM rev.month)::int AS year,
      rev.cnt::int AS event_count,
      rev.rev::int AS revenue,
      COALESCE(exp_out.tot, 0)::int AS expenditure,
      COALESCE(exp_in.tot, 0)::int AS fund_inflow,
      (rev.rev - COALESCE(exp_out.tot, 0))::int AS profit
    FROM rev
    LEFT JOIN exp_out ON exp_out.month = rev.month
    LEFT JOIN exp_in ON exp_in.month = rev.month
    ORDER BY rev.month DESC
  `;
  return rows as unknown as MonthlySummary[];
}

/** Summary for a single date range (day/week/month/custom/all). */
export async function getSummaryByRange(from: string, to: string, periodLabel: string): Promise<SummaryRow> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS event_count,
      COALESCE(SUM(price), 0)::int AS revenue
    FROM events WHERE date >= ${from}::date AND date <= ${to}::date
  `;
  const rev = (rows as unknown[])[0] as { event_count: number; revenue: number };
  const expRows = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS expenditure
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
    AND COALESCE(flow_type, 'expense') = 'expense'
  `;
  const inRows = await sql`
    SELECT COALESCE(SUM(amount), 0)::int AS fund_inflow
    FROM expenditures
    WHERE date >= ${from}::date AND date <= ${to}::date
    AND flow_type = 'income'
  `;
  const exp = (expRows as unknown[])[0] as { expenditure: number };
  const inf = (inRows as unknown[])[0] as { fund_inflow: number };
  const event_count = rev?.event_count ?? 0;
  const revenue = rev?.revenue ?? 0;
  const expenditure = exp?.expenditure ?? 0;
  const fund_inflow = inf?.fund_inflow ?? 0;
  const fund_net = fund_inflow - expenditure;
  return {
    period_label: periodLabel,
    event_count,
    revenue,
    expenditure,
    fund_inflow,
    fund_net,
    profit: revenue - expenditure,
  };
}

// Ensure tables exist (idempotent) — also used by POST /api/init
export async function ensureSchema(): Promise<void> {
  await ensureSchemaOnce();
}
