# KMR Convention

A simple web app to manage a convention hall in Hyderabad: track events, revenue, expenditures, and comments.

---

## What it does

- **Events** — Bookings with date, type (Marriage, Reception, etc.), contact, price (₹), **diesel included (Y/N)**. When diesel is included, a **Diesel expenditure of ₹30,000** is automatically added and linked to that event. Admin can **edit** events from the event detail page.
- **Monthly summary** — Events count, revenue, expenditure, and profit per month.
- **Expenditures** — Log spending by category; optionally **link to an event** (or leave as “current month” general expense). If not linked to an event, **description is required**. If category is **Other**, a **specify category name** field is required. View expenditures **monthly**, **event-wise**, or **yearly**.
- **Comments** — Visitors can add comments on any event.

**Admin** (password in env): after login the page refreshes to show the admin view. Admin can add/edit/delete events and add/delete expenditures. **Everyone** can view and comment.

---

## Tech

- **Next.js 16** + **TypeScript** + **Tailwind CSS**
- **Neon Postgres** (free tier, works on Vercel)

---

## Quick start

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

- `POSTGRES_URL` or `DATABASE_URL` — Neon Postgres connection string
- `ADMIN_PASSWORD` — Admin login password

Then:

```bash
npm run dev
```

Open **http://localhost:3000**. Tables are created automatically on first use.

---

## Deploy (Vercel)

1. Import the repo in Vercel.
2. Add **Neon Postgres** (Storage/Marketplace) and connect it.
3. Set **ADMIN_PASSWORD** in Environment Variables.
4. Deploy. No need to run schema manually — it runs on first request.

---

## Scripts

| Command       | Description        |
|---------------|--------------------|
| `npm run dev` | Start dev server   |
| `npm run build` | Production build |
| `npm run start` | Run production |

---

*KMR Convention — Hyderabad*
