import { createDefaultUser, getNextStreakReward, getTodayInChina, processDailyLogin } from '../../_shared/merit.js';
import { resolveOpenid } from '../../_shared/openid.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';
import { getUserByOpenid, upsertUser } from '../../_shared/users-db.js';

function buildUserPayload(user) {
  return {
    openid: user.openid,
    totalMerit: user.totalMerit,
    loginMerit: user.loginMerit,
    streakMerit: user.streakMerit || 0,
    shareMerit: user.shareMerit || 0,
    lastLoginDate: user.lastLoginDate,
    lastShareDate: user.lastShareDate || null,
    consecutiveDays: user.consecutiveDays,
    maxConsecutiveDays: user.maxConsecutiveDays,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildLoginResponse(result) {
  const { user, isNewLogin, todayReward, dailyMerit = 0, streakBonus = 0 } = result;

  return {
    ok: true,
    isNewLogin,
    todayReward,
    dailyMerit,
    streakBonus,
    today: getTodayInChina(),
    nextStreakReward: getNextStreakReward(user.consecutiveDays),
    user: buildUserPayload(user),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : null;

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

  if (request.method === 'GET') {
    return jsonResponse(buildLoginResponse({
      user,
      isNewLogin: false,
      todayReward: 0,
    }));
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method not allowed' }, 405);
  }

  const result = processDailyLogin(user);
  if (result.isNewLogin) {
    await upsertUser(env.DB, result.user);
  }

  return jsonResponse(buildLoginResponse(result));
}
