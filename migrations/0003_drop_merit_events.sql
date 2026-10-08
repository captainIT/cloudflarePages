ALTER TABLE users ADD COLUMN streak_merit INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET streak_merit = COALESCE((
  SELECT SUM(amount)
  FROM merit_events
  WHERE merit_events.openid = users.openid
    AND merit_events.type = 'login_streak'
), 0);

DROP INDEX IF EXISTS idx_merit_events_openid_created;
DROP INDEX IF EXISTS idx_merit_events_openid;
DROP TABLE IF EXISTS merit_events;
