import { neon } from '@neondatabase/serverless';
import type { Event, Expenditure, Comment, MonthlySummary } from './types';

function getSql() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL or DATABASE_URL');
  }
  return neon(connectionString);
}

// Neon returns rows array directly
export async function getEvents(from?: string, to?: string): Promise<Event[]> {
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at
      FROM events WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date ASC
    `;
    return rows as unknown as Event[];
  }
  const rows = await sql`
    SELECT id, date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at
    FROM events ORDER BY date DESC
  `;
  return rows as unknown as Event[];
}

export async function getEventById(id: string): Promise<Event | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at
    FROM events WHERE id = ${id}::uuid
  `;
  return (rows as unknown as Event[])[0] ?? null;
}

export async function createEvent(data: {
  date: string;
  event_type: string;
  contact_info?: string;
  price: number;
  diesel_included: boolean;
  notes?: string;
}): Promise<Event> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO events (date, event_type, contact_info, price, diesel_included, notes)
    VALUES (${data.date}::date, ${data.event_type}, ${data.contact_info ?? null}, ${data.price}, ${data.diesel_included}, ${data.notes ?? null})
    RETURNING id, date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at
  `;
  return (rows as unknown as Event[])[0];
}

export async function updateEvent(
  id: string,
  data: Partial<{
    date: string;
    event_type: string;
    contact_info: string;
    price: number;
    diesel_included: boolean;
    notes: string;
  }>
): Promise<Event | null> {
  const event = await getEventById(id);
  if (!event) return null;
  const sql = getSql();
  const rows = await sql`
    UPDATE events SET
      date = COALESCE(${data.date ?? event.date}::date, date),
      event_type = COALESCE(${data.event_type ?? event.event_type}, event_type),
      contact_info = COALESCE(${data.contact_info ?? event.contact_info}, contact_info),
      price = COALESCE(${data.price ?? event.price}, price),
      diesel_included = COALESCE(${data.diesel_included ?? event.diesel_included}, diesel_included),
      notes = COALESCE(${data.notes ?? event.notes}, notes),
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at
  `;
  return (rows as unknown as Event[])[0] ?? null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM events WHERE id = ${id}::uuid RETURNING id
  `;
  return (rows as unknown as Event[]).length > 0;
}

// Expenditures
export async function getExpenditures(from?: string, to?: string): Promise<Expenditure[]> {
  const sql = getSql();
  if (from && to) {
    const rows = await sql`
      SELECT id, date, amount, category, description, created_at
      FROM expenditures WHERE date >= ${from}::date AND date <= ${to}::date
      ORDER BY date DESC
    `;
    return rows as unknown as Expenditure[];
  }
  const rows = await sql`
    SELECT id, date, amount, category, description, created_at
    FROM expenditures ORDER BY date DESC
  `;
  return rows as unknown as Expenditure[];
}

export async function createExpenditure(data: {
  date: string;
  amount: number;
  category: string;
  description?: string;
}): Promise<Expenditure> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO expenditures (date, amount, category, description)
    VALUES (${data.date}::date, ${data.amount}, ${data.category}, ${data.description ?? null})
    RETURNING id, date, amount, category, description, created_at
  `;
  return (rows as unknown as Expenditure[])[0];
}

export async function deleteExpenditure(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM expenditures WHERE id = ${id}::uuid RETURNING id
  `;
  return (rows as unknown as Expenditure[]).length > 0;
}
export async function getCommentsByEventId(eventId: string): Promise<Comment[]> {
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

// Ensure tables exist (idempotent)
export async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      contact_info VARCHAR(500),
      price INTEGER NOT NULL,
      diesel_included BOOLEAN NOT NULL DEFAULT false,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
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
}
