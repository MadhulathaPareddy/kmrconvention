import { neon } from '@neondatabase/serverless';
import type {
  Event,
  Expenditure,
  ExpenditureDeletion,
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
       * re-inserted deleted Diesel rows. Use ensureDieselExpenditureForEvent on create/update,
       * or run a one-time SQL migration in the dashboard if needed for legacy data. */
    })();
  }
  await schemaPromise;
}

const DIESEL_EXPENDITURE_AMOUNT = 30000;

/** Ensure one Diesel expenditure (₹30,000) exists for this event. Idempotent. */
async function ensureDieselExpenditureForEvent(
  sql: ReturnType<typeof getSql>,
  eventId: string,
  eventDate: string
): Promise<void> {
  const flags = await sql`
    SELECT diesel_expenditure_suppressed FROM events WHERE id = ${eventId}::uuid
  `;
  const fr = (flags as unknown[])[0] as { diesel_expenditure_suppressed?: boolean } | undefined;
  if (fr?.diesel_expenditure_suppressed === true) return;

  const existing = await sql`
    SELECT 1 FROM expenditures
    WHERE event_id = ${eventId}::uuid AND category = 'Diesel' AND amount = ${DIESEL_EXPENDITURE_AMOUNT}
    LIMIT 1
  `;
  if (Array.isArray(existing) && existing.length > 0) return;
  await sql`
    INSERT INTO expenditures (date, amount, category, description, event_id)
    VALUES (${eventDate}::date, ${DIESEL_EXPENDITURE_AMOUNT}, 'Diesel', 'Diesel (included with event)', ${eventId}::uuid)
  `;
}

// Neon returns rows array directly; normalize Event with diesel_type (diesel_included = diesel_type != null)
function toEvent(row: Record<string, unknown>): Event {
  const r = row as Record<string, unknown>;
  const diesel_type = (r.diesel_type as string) || null;
  return {
    id: String(r.id),
    date: String(r.date),
    event_type: String(r.event_type),
    contact_info: r.contact_info != null ? String(r.contact_info) : null,
    price: Number(r.price),
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
    SELECT id, date, event_type, contact_info, price, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
    FROM events ORDER BY date DESC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => toEvent(r as Record<string, unknown>));
}

export async function getEventById(id: string): Promise<Event | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, event_type, contact_info, price, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
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
  diesel_type?: string | null;
  diesel_included?: boolean;
  notes?: string;
}): Promise<Event> {
  await ensureSchemaOnce();
  const sql = getSql();
  const dieselType = data.diesel_type ?? (data.diesel_included ? 'KMR' : null);
  const rows = await sql`
    INSERT INTO events (date, event_type, contact_info, price, diesel_type, notes)
    VALUES (${data.date}::date, ${data.event_type}, ${data.contact_info ?? null}, ${data.price}, ${dieselType}, ${data.notes ?? null})
    RETURNING id, date, event_type, contact_info, price, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
  `;
  const row = (rows as unknown[])[0];
  const event = row ? toEvent(row as Record<string, unknown>) : null;
  if (event && (dieselType === 'KMR' || dieselType === 'GUEST')) {
    await ensureDieselExpenditureForEvent(sql, event.id, event.date);
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
  const rows = await sql`
    UPDATE events SET
      date = COALESCE(${data.date ?? event.date}::date, date),
      event_type = COALESCE(${data.event_type ?? event.event_type}, event_type),
      contact_info = COALESCE(${data.contact_info ?? event.contact_info}, contact_info),
      price = COALESCE(${data.price ?? event.price}, price),
      diesel_type = ${dieselType ?? null},
      diesel_expenditure_suppressed = ${nextSuppressed},
      notes = COALESCE(${data.notes ?? event.notes}, notes),
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, date, event_type, contact_info, price, diesel_included, diesel_type, diesel_expenditure_suppressed, notes, created_at, updated_at
  `;
  const row = (rows as unknown[])[0];
  const updated = row ? toEvent(row as Record<string, unknown>) : null;
  if (updated && (updated.diesel_type === 'KMR' || updated.diesel_type === 'GUEST')) {
    await ensureDieselExpenditureForEvent(sql, updated.id, updated.date);
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

// Expenditures
export async function getExpenditures(from?: string, to?: string): Promise<Expenditure[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, amount, category, description, event_id, category_other, created_at
      FROM expenditures WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date DESC
    `;
    return rows as unknown as Expenditure[];
  }
  const rows = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, created_at
    FROM expenditures ORDER BY date DESC
  `;
  return rows as unknown as Expenditure[];
}

export async function createExpenditure(data: {
  date: string;
  amount: number;
  category: string;
  description?: string;
  event_id?: string | null;
  category_other?: string | null;
}): Promise<Expenditure> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO expenditures (date, amount, category, description, event_id, category_other)
    VALUES (${data.date}::date, ${data.amount}, ${data.category}, ${data.description ?? null}, ${data.event_id ?? null}, ${data.category_other ?? null})
    RETURNING id, date, amount, category, description, event_id, category_other, created_at
  `;
  return (rows as unknown as Expenditure[])[0];
}

export async function getExpenditureById(id: string): Promise<Expenditure | null> {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, amount, category, description, event_id, category_other, created_at
    FROM expenditures WHERE id = ${id}::uuid
  `;
  const arr = rows as unknown as Expenditure[];
  return arr.length > 0 ? arr[0] : null;
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
    created_at: row.created_at,
  };
  await sql`
    INSERT INTO expenditure_deletions (expenditure_id, snapshot, reason)
    VALUES (${id}::uuid, ${JSON.stringify(snapshot)}::jsonb, ${reason})
  `;
  if (
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
      exp AS (
        SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
        FROM expenditures GROUP BY date_trunc('month', date)
      )
      SELECT
        to_char(rev.month, 'YYYY-MM') AS month,
        EXTRACT(YEAR FROM rev.month)::int AS year,
        rev.cnt::int AS event_count,
        rev.rev::int AS revenue,
        COALESCE(exp.tot, 0)::int AS expenditure,
        (rev.rev - COALESCE(exp.tot, 0))::int AS profit
      FROM rev
      LEFT JOIN exp ON exp.month = rev.month
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
    exp AS (
      SELECT date_trunc('month', date) AS month, COALESCE(SUM(amount), 0) AS tot
      FROM expenditures GROUP BY date_trunc('month', date)
    )
    SELECT
      to_char(rev.month, 'YYYY-MM') AS month,
      EXTRACT(YEAR FROM rev.month)::int AS year,
      rev.cnt::int AS event_count,
      rev.rev::int AS revenue,
      COALESCE(exp.tot, 0)::int AS expenditure,
      (rev.rev - COALESCE(exp.tot, 0))::int AS profit
    FROM rev
    LEFT JOIN exp ON exp.month = rev.month
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
    FROM expenditures WHERE date >= ${from}::date AND date <= ${to}::date
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

// Ensure tables exist (idempotent) — also used by POST /api/init
export async function ensureSchema(): Promise<void> {
  await ensureSchemaOnce();
}
