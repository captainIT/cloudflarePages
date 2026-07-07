ALTER TABLE users ADD COLUMN share_merit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_share_date TEXT;

CREATE TABLE IF NOT EXISTS merit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merit_events_openid ON merit_events (openid);
CREATE INDEX IF NOT EXISTS idx_merit_events_openid_created ON merit_events (openid, created_at DESC);
