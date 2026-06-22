CREATE TABLE IF NOT EXISTS users (
  openid TEXT PRIMARY KEY NOT NULL,
  total_merit INTEGER NOT NULL DEFAULT 0,
  login_merit INTEGER NOT NULL DEFAULT 0,
  last_login_date TEXT,
  consecutive_days INTEGER NOT NULL DEFAULT 0,
  max_consecutive_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at);
