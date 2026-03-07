# KMR Convention — Hyderabad

TypeScript web app for managing a convention hall: events, revenue, expenditures, and comments.

## Features

- **Events**: Date, type (Marriage, Reception, Birthday, Corporate, Other), contact info, price (₹), diesel included (Y/N), notes.
- **Monthly summary**: Event count, revenue, expenditure, and profit by month.
- **Expenditures**: By category — Diesel, Maintenance, Staff, Utilities, Catering, Cleaning, Security, Supplies, Decoration, Other.
- **Comments**: Anyone can view events and add comments on an event (name, email optional, content).
- **Roles**:
  - **Admin**: Add/edit/delete events, add/delete expenditures. Set password via `ADMIN_PASSWORD` env.
  - **User**: View events, monthly summary, and add comments.

## Tech stack

- **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS**
- **Vercel Postgres** (Neon) — use **Neon Postgres** from the Vercel Storage/Marketplace (free tier). The project uses `@neondatabase/serverless`; set `POSTGRES_URL` or `DATABASE_URL` to your Neon connection string.

## Local development

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Database**

   Use [Neon Postgres](https://neon.tech) (free tier) with Vercel:

   - Create a project on [Vercel](https://vercel.com).
   - In the project: **Storage** → **Create Database** → choose **Postgres** (Neon), or add **Neon** from the Integrations/Marketplace.
   - Connect the database; Vercel may add `POSTGRES_URL` or you can copy the connection string and set `DATABASE_URL` in env.

   For local env, copy the Neon connection string and add to `.env.local`:

   ```bash
   cp .env.example .env.local
   # Edit .env.local: set POSTGRES_URL or DATABASE_URL, and ADMIN_PASSWORD.
   ```

   Create tables once (either run the SQL below in the Vercel Postgres query tab, or call the init API once):

   ```bash
   curl -X POST http://localhost:3000/api/init
   ```

   Or run the SQL in `src/lib/schema.sql` in the **Vercel Dashboard → Storage → your Postgres → Query** tab.

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Log in as admin with `ADMIN_PASSWORD` to add events and expenditures.

## Deploy on Vercel

1. Push the repo to GitHub and import the project in Vercel.
2. Add **Storage** → **Postgres** (Neon) and connect it to the project (env vars are set automatically).
3. In **Settings → Environment Variables**, set:
   - `ADMIN_PASSWORD` — strong password for admin login.
4. Deploy. After first deploy, run the schema once:
   - Either run the contents of `src/lib/schema.sql` in **Vercel → Storage → Postgres → Query**,
   - Or `curl -X POST https://your-app.vercel.app/api/init` (optional, if you prefer API init).

## Environment variables

| Variable           | Description                                  |
|--------------------|----------------------------------------------|
| `POSTGRES_URL` or `DATABASE_URL` | Neon Postgres connection string (from Vercel or Neon dashboard) |
| `ADMIN_PASSWORD`   | Password for admin login (required)          |

## Project structure

- `src/app/` — App Router pages and API routes.
- `src/app/api/` — Auth, events, expenditures, comments, summary, init.
- `src/lib/` — `db.ts` (queries), `auth.ts`, `types.ts`, `format.ts`, `schema.sql`.
- `src/components/` — `Nav`, `AuthProvider`.

## License

Private use for KMR Convention.
