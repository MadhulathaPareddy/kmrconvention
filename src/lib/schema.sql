-- KMR Convention: Run this in Vercel Postgres (Neon) SQL editor or via npm run db:push
-- Or use Vercel Dashboard > Storage > Postgres > Query

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
);

CREATE TABLE IF NOT EXISTS expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_name VARCHAR(200) NOT NULL,
  author_email VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_month ON events((date_trunc('month', date)));
CREATE INDEX IF NOT EXISTS idx_expenditures_date ON expenditures(date);
CREATE INDEX IF NOT EXISTS idx_expenditures_month ON expenditures((date_trunc('month', date)));
CREATE INDEX IF NOT EXISTS idx_comments_event_id ON comments(event_id);
