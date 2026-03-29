# KMR Convention

Web app for **KMR Convention Hall** (Hyderabad): event bookings, hall account movements (expenditures and royalties), monthly views, an admin **Summary**, and a separate **investment ledger** for partner / external funds.

**Time zone:** All “today”, calendar months, weeks, and formatted dates/times use **Indian Standard Time (IST, `Asia/Kolkata`)**. Helpers live in `src/lib/ist.ts`; display uses `src/lib/format.ts`.

---

## Table of contents

1. [Who can use what](#who-can-use-what)
2. [How the app flows](#how-the-app-flows)
3. [Money and summaries (brief)](#money-and-summaries-brief)
4. [Tech stack](#tech-stack)
5. [Quick start](#quick-start)
6. [Deploy (Vercel)](#deploy-vercel)
7. [Scripts](#scripts)
8. [Further documentation](#further-documentation)
9. [Security notes](#security-notes)

---

## Who can use what

### Without admin login (guest)

- **Dashboard (`/`)** — Lists events for **this calendar month (IST)** or **all events** (toggle). Shows **upcoming vs completed** (relative to **today in IST**). **Prices and revenue are not shown** on this view.
- **Admin login (`/login`)** — Password from environment; sets an httpOnly session cookie (see [Security notes](#security-notes)).

Guests **do not** open `/summary` (they are redirected home) or **`/events/[id]`** (event detail is **admin-only** today).

### With admin login

Navigation adds **Events**, **Add Event**, **Expenditures**, **Investment ledger**, **Summary**, and **Logout**.

- **Dashboard (`/`)** — Same site root, **admin view**: cards for **events this month**, **revenue**, **expenses (spent)**, **profit** (from monthly aggregates), plus a **recent events** table **with prices** and diesel flags.
- **Events (`/events`)** — Full events table; filters **this week / this month / all** (ranges computed in **IST**). **Edit** goes to the edit form. **View changes** opens a modal with update history for events that have been edited.
- **Add Event (`/admin/events`)** — Create a booking: date, type, contact, price, decor/kitchen royalty, **Incl_Diesel** (KMR / GUEST / none), diesel amount, notes. Default **date** is **today (IST)**.
- **Edit Event (`/admin/events/[id]/edit`)** — Update fields; a **change comment is required** and is stored on the audit trail. After save, you return to the event detail page.
- **Event detail (`/events/[id]`)** — Full breakdown (price, royalties, diesel, optional tagged revenue, **total revenue**), **update history**, **comments**, edit/delete actions.
- **Expenditures (`/admin/expenditures`)** — Add **funds spent (expense)** or **funds added (royalty)** with optional **link to an event**. Lists below group **active** rows by **month**, **event**, or **year**. **Deleted expenses** is a third mode on the same card: audit list with filters (event, month, year, specific date). The old `/admin/expenditures/deleted` URL **redirects** here.
- **Investment ledger (`/admin/investment-ledger`)** — Partner investments, external borrows, expenses, pending bills, payments, and an audit trail. Period presets use **IST** ranges.
- **Summary (`/summary`)** — Admin-only snapshot: event count, revenue, expenditure, profit over **day / week / month / all time** (and custom range), using **IST** for preset ranges.

---

## How the app flows

1. **Database** — On first use, `src/lib/db.ts` runs `ensureSchemaOnce()`: creates tables (events, expenditures, comments, deletions/history, investment ledger, etc.) and applies lightweight `ALTER`s when new columns are added. No separate migration CLI is required for typical deploys.

2. **Auth** — `src/lib/auth.ts`: admin session is a cookie validated against `ADMIN_PASSWORD`. All sensitive pages and APIs check `isAdmin()` where needed.

3. **Events** — Stored with a **calendar `date`** (`YYYY-MM-DD`). Public listings compare that string to **IST today** for “upcoming”. **Non-admin GET** for a single event hides **past** events (404) and returns a **redacted payload** without money fields (`src/lib/publicEvent.ts`) where that route is used for public clients; the **event detail page** itself is admin-only.

4. **Editing events** — `PATCH /api/events/[id]` requires **`change_comment`**. `updateEvent` writes a row to **`event_history`** (snapshot before update + comment). **GET `/api/events/[id]/history`** is admin-only.

5. **Diesel** — When an event has **KMR** or **GUEST** diesel, the app can sync a linked **Diesel** line under expenditures (`syncDieselExpenditureForEvent` in `src/lib/db.ts`). Suppression flags prevent resurrecting auto-lines after admin removal.

6. **Expenditures** — Expenses and income rows live in `expenditures` with `flow_type`. Deleting an expenditure records **`expenditure_deletions`** (snapshot + reason). **Income with `event_id`** can count toward that event / monthly revenue logic used on the dashboard and Summary (see code and comments around `getTaggedIncomeSumForEvent` / summaries in `db.ts`).

7. **Formatting** — Amounts: `formatINR`. Calendar dates and timestamps: **`formatDate`** / **`formatDateTime`** in `src/lib/format.ts` (IST).

---

## Money and summaries (brief)

- **Dashboard (admin)** monthly cards use **`getMonthlySummaries`** (booking revenue + tagged royalty income by rules in SQL, minus expense outflows for profit display).
- **Summary page** uses **`getSummaryByRange`** (and related API) for the selected IST range.
- **Investment ledger** is a **separate** concern from hall **expenditures**; it tracks partner/external positions, pending bills, and audit rows.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS 4** |
| Language | **TypeScript** |
| Database | **Neon** (serverless **Postgres**) via `@neondatabase/serverless` |

---

## Quick start

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` **or** `DATABASE_URL` | Neon Postgres connection string |
| `ADMIN_PASSWORD` | Password for admin login |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Schema is ensured on first DB access.

---

## Deploy (Vercel)

1. Import the repository in Vercel.
2. Add **Neon Postgres** (or connect an existing Neon project) and set **`POSTGRES_URL`** or **`DATABASE_URL`**.
3. Set **`ADMIN_PASSWORD`** in project environment variables.
4. Deploy. You do not need to run SQL migrations manually for the built-in schema bootstrap.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server (after build) |
| `npm run lint` | ESLint |
| `npm run spec:docx` | Export `KMR_Convention_Spec.md` to Word (requires [pandoc](https://pandoc.org/)) |

---

## Further documentation

- **`KMR_Convention_Spec.md`** — Longer product/spec narrative (build a `.docx` with `npm run spec:docx` if needed).

---

## Security notes

- The admin **cookie currently stores the plaintext password** matching `ADMIN_PASSWORD`. That is simple but **weak** if the cookie were ever exposed; a production hardening step is to use a **signed token** or **opaque session id** instead of storing the password value.
- **`POST /api/comments`** does not require admin auth. The **comment UI** today lives on **`/events/[id]`**, which is **admin-only**, so guests do not see the form in-app; if you expose event pages to the public later, **rate limiting** and/or auth on comment creation should be considered.

---

*KMR Convention — Hyderabad*
