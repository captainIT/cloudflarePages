import { createDefaultUser, getTodayInChina, processShareMerit } from '../../_shared/merit.js';
import { resolveOpenid } from '../../_shared/openid.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';
import { getUserByOpenid, insertMeritEvents, upsertUser } from '../../_shared/users-db.js';

function buildUserPayload(user) {
  return {
    openid: user.openid,
    totalMerit: user.totalMerit,
    loginMerit: user.loginMerit,
    shareMerit: user.shareMerit || 0,
    lastLoginDate: user.lastLoginDate,
    lastShareDate: user.lastShareDate || null,
    consecutiveDays: user.consecutiveDays,
    maxConsecutiveDays: user.maxConsecutiveDays,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method not allowed' }, 405);
  }

  const body = await request.json().catch(() => ({}));

  let openid = '';
  try {
    openid = await resolveOpenid(request, body, env);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || 'failed to resolve openid',
    }, 400);
  }

  if (!openid) {
    return jsonResponse({ ok: false, error: 'openid or code is required' }, 400);
  }

  if (!env.DB) {
    return jsonResponse({ ok: false, error: 'database not configured' }, 500);
  }

  const existing = await getUserByOpenid(env.DB, openid);
  const user = existing || createDefaultUser(openid);
  const result = processShareMerit(user);

  await upsertUser(env.DB, result.user);
  if (result.events?.length) {
    await insertMeritEvents(env.DB, openid, result.events);
  }

  return jsonResponse({
    ok: true,
    isNewShare: result.isNewShare,
    todayReward: result.todayReward,
    today: getTodayInChina(),
    user: buildUserPayload(result.user),
  });
}
