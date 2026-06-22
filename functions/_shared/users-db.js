function rowToUser(row) {
  return {
    openid: row.openid,
    totalMerit: row.total_merit,
    loginMerit: row.login_merit,
    lastLoginDate: row.last_login_date,
    consecutiveDays: row.consecutive_days,
    maxConsecutiveDays: row.max_consecutive_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
        last_login_date,
        consecutive_days,
        max_consecutive_days,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(openid) DO UPDATE SET
        total_merit = excluded.total_merit,
        login_merit = excluded.login_merit,
        last_login_date = excluded.last_login_date,
        consecutive_days = excluded.consecutive_days,
        max_consecutive_days = excluded.max_consecutive_days,
        updated_at = excluded.updated_at
    `)
    .bind(
      user.openid,
      user.totalMerit,
      user.loginMerit,
      user.lastLoginDate,
      user.consecutiveDays,
      user.maxConsecutiveDays,
      user.createdAt,
      user.updatedAt,
    )
    .run();
}
