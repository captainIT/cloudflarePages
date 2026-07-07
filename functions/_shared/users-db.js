function rowToUser(row) {
  return {
    openid: row.openid,
    totalMerit: row.total_merit,
    loginMerit: row.login_merit,
    shareMerit: row.share_merit || 0,
    lastLoginDate: row.last_login_date,
    lastShareDate: row.last_share_date || null,
    consecutiveDays: row.consecutive_days,
    maxConsecutiveDays: row.max_consecutive_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMeritEvent(row) {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    eventDate: row.event_date,
    createdAt: row.created_at,
  };
}

export async function getUserByOpenid(db, openid) {
  const row = await db
    .prepare('SELECT * FROM users WHERE openid = ?')
    .bind(openid)
    .first();

  if (!row) {
    return null;
  }

  return rowToUser(row);
}

export async function upsertUser(db, user) {
  await db
    .prepare(`
      INSERT INTO users (
        openid,
        total_merit,
        login_merit,
        share_merit,
        last_login_date,
        last_share_date,
        consecutive_days,
        max_consecutive_days,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(openid) DO UPDATE SET
        total_merit = excluded.total_merit,
        login_merit = excluded.login_merit,
        share_merit = excluded.share_merit,
        last_login_date = excluded.last_login_date,
        last_share_date = excluded.last_share_date,
        consecutive_days = excluded.consecutive_days,
        max_consecutive_days = excluded.max_consecutive_days,
        updated_at = excluded.updated_at
    `)
    .bind(
      user.openid,
      user.totalMerit,
      user.loginMerit,
      user.shareMerit || 0,
      user.lastLoginDate,
      user.lastShareDate || null,
      user.consecutiveDays,
      user.maxConsecutiveDays,
      user.createdAt,
      user.updatedAt,
    )
    .run();
}

export async function insertMeritEvents(db, openid, events) {
  if (!events.length) {
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO merit_events (openid, type, amount, description, event_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const batch = events.map((event) => stmt.bind(
    openid,
    event.type,
    event.amount,
    event.description,
    event.eventDate,
    event.createdAt,
  ));

  await db.batch(batch);
}

export async function getMeritEvents(db, openid, { limit = 20, offset = 0 } = {}) {
  const rows = await db
    .prepare(`
      SELECT id, type, amount, description, event_date, created_at
      FROM merit_events
      WHERE openid = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `)
    .bind(openid, limit, offset)
    .all();

  return (rows.results || []).map(rowToMeritEvent);
}

export async function getMeritSummaryByType(db, openid) {
  const rows = await db
    .prepare(`
      SELECT type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM merit_events
      WHERE openid = ?
      GROUP BY type
    `)
    .bind(openid)
    .all();

  const byType = {};
  for (const row of rows.results || []) {
    byType[row.type] = {
      count: row.count,
      total: row.total,
    };
  }

  return byType;
}

export async function countMeritEvents(db, openid) {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM merit_events WHERE openid = ?')
    .bind(openid)
    .first();

  return row?.count || 0;
}
