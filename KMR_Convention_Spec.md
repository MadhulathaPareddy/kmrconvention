# KMR Convention — Project Specification Document

**Purpose:** Use this document to brief other people or spec tools on what was built.

**To get a Word (.docx) file:**  
- **Option A:** Open this file in **Microsoft Word** (File → Open → select `KMR_Convention_Spec.md`), then **File → Save As → Word Document (.docx)**.  
- **Option B:** If you have [pandoc](https://pandoc.org) installed, run in the project folder:  
  `pandoc KMR_Convention_Spec.md -o KMR_Convention_Spec.docx`

---

## 1. Project overview

**Name:** KMR Convention  
**Type:** Web application (convention hall management)  
**Location context:** Hyderabad  
**Stack:** TypeScript, Next.js 16 (App Router), Tailwind CSS, Neon Postgres (serverless)

The app replaces or supplements a spreadsheet used to track event bookings, prices, diesel inclusion, and contact info. It adds monthly revenue/expenditure summaries, multiple expenditure categories, and a simple role model (admin vs viewer with comments).

---

## 2. Business requirements (addressed)

- Track **events** with: date, event type, event contact info, price (Indian Rupees), whether diesel is included (Y/N), and optional notes.
- Support event types: Marriage, Reception, Birthday, Corporate, Other.
- Track **monthly** metrics: number of events, total revenue, total expenditure, and profit per month.
- Track **expenditures** with: date, amount, category, and optional description.
- Expenditure categories: Diesel, Maintenance, Staff, Utilities, Catering, Cleaning, Security, Supplies, Decoration, Other.
- **Two roles:**  
  - **Admin:** Can add, **edit**, and delete events; add and delete expenditures. Authenticated via a single shared password (environment variable). **After login, the app does a full page reload so the admin view (Add Event, Expenditures, Logout) appears immediately.**
- **User (viewer):** Can view all events, monthly summary, and event details; can add comments on events (name, optional email, comment text). Cannot add or edit events or expenditures.
- Use a **free, Vercel-friendly database** — implemented with Neon Postgres (free tier), accessible from Vercel via connection string.
- **Expenditures:** Can optionally be **linked to an event** (dropdown). If not linked, the expense is treated as general/current month and **description is mandatory**. If category is **Other**, a **“Specify category name”** field is required. Expenditures can be viewed in three ways: **monthly** (grouped by month), **event-wise** (grouped by linked event or “No event”), and **yearly** (grouped by year).

---

## 3. Technical implementation summary

### 3.1 Frontend and hosting

- **Framework:** Next.js 16 with App Router.
- **Language:** TypeScript.
- **Styling:** Tailwind CSS. **White background with seagreen** accent theme.
- **Deployment target:** Vercel (or any Node host); database is external (Neon).

### 3.2 Database

- **Provider:** Neon Postgres (serverless).
- **Connection:** `POSTGRES_URL` or `DATABASE_URL` in environment. No separate ORM; raw SQL via `@neondatabase/serverless`.
- **Schema creation:** Tables are created automatically on first use (`CREATE TABLE IF NOT EXISTS`), so no manual SQL or one-off “init” step is required for a new database. Optional: run SQL in `src/lib/schema.sql` or call `POST /api/init` if preferred.

### 3.3 Data model

- **events**  
  - id (UUID), date, event_type, contact_info, price, diesel_included, notes, created_at, updated_at.
- **expenditures**  
  - id (UUID), date, amount, category, description, **event_id** (optional FK to events, SET NULL on delete), **category_other** (when category is “Other”), created_at.
- **comments**  
  - id (UUID), event_id (FK to events, CASCADE delete), author_name, author_email, content, created_at.

Monthly summaries (event count, revenue, expenditure, profit) are **computed** from `events` and `expenditures` (grouped by month), not stored as separate tables.

### 3.4 Authentication and authorization

- **Admin:** Single shared secret in `ADMIN_PASSWORD`. Login via `POST /api/auth/login` with `{ "password": "..." }`. Session stored in an HTTP-only cookie. Logout via `POST /api/auth/logout`. Session check via `GET /api/auth/session` (returns `{ "admin": true/false }`).
- **User:** No login. Anyone can view public pages and post comments. No sign-up or user table.

### 3.5 API surface

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- **Events:** `GET /api/events` (optional query: `from`, `to`), `POST /api/events`, `GET /api/events/[id]`, `PATCH /api/events/[id]`, `DELETE /api/events/[id]`. Mutations require admin.
- **Expenditures:** `GET /api/expenditures` (optional `from`, `to`), `POST /api/expenditures` (body may include `event_id`, `category_other` when category is “Other”; validation: description required when not linked to event, category_other required when category is “Other”), `DELETE /api/expenditures/[id]`. Mutations require admin.
- **Comments:** `GET /api/comments?eventId=...`, `POST /api/comments`. No auth required for comments.
- **Summary:** `GET /api/summary` (optional query: `year`). Returns monthly aggregates.
- **Init (optional):** `POST /api/init` — ensures schema exists (calls same logic as auto-init).

### 3.6 Main pages and flows

- **Dashboard (/):** Current month’s event count, revenue, expenditure, profit; list of recent events with links to detail.
- **Events list (/events):** Table of all events (date, type, contact, price, diesel). Links to event detail.
- **Event detail (/events/[id]):** Single event info, **Edit event** button (admin only, links to edit page), and a comments section (list + form to add comment).
- **Monthly summary (/summary):** Table of months with event count, revenue, expenditure, profit.
- **Admin — Add event (/admin/events):** Form to create event (date, type, contact, price, diesel, notes). Protected; redirects to login if not admin.
- **Admin — Edit event (/admin/events/[id]/edit):** Form to update an existing event (same fields as add). Protected.
- **Admin — Expenditures (/admin/expenditures):** Form to add expenditure (date, amount, category, optional **link to event**, description; when category “Other”, **specify category name**). **View modes:** Monthly, Event-wise, Yearly. Protected.
- **Login (/login):** Password form; on success sets admin cookie and **redirects to home with a full page reload** so the admin view is shown immediately.

Admin routes are wrapped in a layout that checks admin session and redirects to `/login` if not authenticated.

### 3.7 Important implementation details

- **Currency:** All monetary values are in Indian Rupees (₹); displayed with `Intl.NumberFormat` for INR.
- **Schema auto-init:** On first DB access, the app runs `ensureSchemaOnce()` which creates the three tables if they do not exist. Existing databases receive new columns (`event_id`, `category_other` on expenditures) via conditional `ALTER TABLE` so no manual migration is required.
- **Comments:** Stored per event; no moderation or edit/delete in the current scope.
- **Admin login:** After successful login, the client performs a full page redirect (`window.location.href = '/'`) so the next request sends the session cookie and the server-rendered layout shows admin nav (Add Event, Expenditures, Logout) immediately.

---

## 4. File and folder structure (high level)

- **README.md** — Basic project details and quick start.
- **.env.example** — Example env vars (POSTGRES_URL or DATABASE_URL, ADMIN_PASSWORD).
- **src/app/** — Next.js App Router: `page.tsx` (dashboard), `layout.tsx`, `login/page.tsx`, `events/page.tsx`, `events/[id]/page.tsx` (with Edit event button for admin), `summary/page.tsx`, `admin/events/page.tsx`, `admin/events/[id]/edit/page.tsx` (edit event), `admin/expenditures/page.tsx` (with ExpenditureForm and ExpenditureViews: monthly / event-wise / yearly), `admin/layout.tsx`.
- **src/app/api/** — Route handlers: auth (login, logout, session), events (CRUD), expenditures (create, list, delete), comments (list, create), summary (monthly aggregates), init (schema).
- **src/lib/** — `db.ts` (Neon client, schema init, all queries), `auth.ts` (admin session helpers), `types.ts` (Event, Expenditure, Comment, categories), `format.ts` (INR, date formatting), `schema.sql` (reference DDL).
- **src/components/** — `Nav.tsx` (navigation and admin/user actions), `AuthProvider.tsx` (client-side admin state).

---

## 5. What was done “so far” (for handover or spec tools)

- Full event CRUD and listing with filters (date range). **Admin can edit events** from the event detail page (Edit event button) or via `/admin/events/[id]/edit`.
- Expenditure create/delete and listing; **optional link to event** (dropdown; if not linked, **description required**); when category is **Other**, **category_other (specify category name) required**. **Expenditure views:** monthly, event-wise, and yearly (grouped with totals).
- Comments on events (create and list).
- Monthly summary (event count, revenue, expenditure, profit) with optional year filter.
- Admin authentication (password, cookie session); **full page redirect after login** so admin view shows immediately. Protection of admin-only pages and APIs.
- Public dashboard, events list, event detail with comments, and monthly summary.
- Neon Postgres integration with automatic schema creation (and optional column migration for existing DBs).
- README and this spec document. **Theme:** white background with seagreen accents.

---

## 6. Possible future extensions (not implemented)

- Edit/delete comments; comment moderation.
- Multiple admin users or role-based access.
- Export (e.g. CSV/Excel) of events or summary.
- Date range filters on dashboard or summary.
- Recurring or multi-day events; capacity or hall-specific fields.

---

*Document generated for KMR Convention project handover and specification sharing. Last updated to reflect current codebase (admin login refresh, edit event, expenditure event link and Other category, monthly/event-wise/yearly expenditure views).*
