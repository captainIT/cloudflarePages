import { handleOptions, jsonResponse } from '../_shared/response.js';

export async function onRequest(context) {
  const { request, env } = context;
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  const url = new URL(request.url);

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    const openid = payload.openid || 'test-openid';
    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO users (
          openid, total_merit, login_merit, last_login_date,
          consecutive_days, max_consecutive_days, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(openid) DO UPDATE SET
          total_merit = excluded.total_merit,
          updated_at = excluded.updated_at
      `)
      .bind(
        openid,
        payload.totalMerit ?? 0,
        payload.loginMerit ?? 0,
        payload.lastLoginDate ?? null,
        payload.consecutiveDays ?? 0,
        payload.maxConsecutiveDays ?? 0,
        payload.createdAt ?? now,
        now,
      )
      .run();

    return jsonResponse({ ok: true, openid, saved: payload });
  }

  const stats = await env.DB
    .prepare('SELECT COUNT(*) AS userCount FROM users')
    .first();

  return jsonResponse({
    ok: true,
    message: 'D1 database test',
    method: request.method,
    path: url.pathname,
    userCount: stats?.userCount ?? 0,
    timestamp: new Date().toISOString(),
  });
}
