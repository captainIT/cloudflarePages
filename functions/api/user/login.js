import { createDefaultUser, getNextStreakReward, getTodayInChina, processDailyLogin } from '../../_shared/merit.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';

function getOpenid(request, body) {
  if (body?.openid) {
    return body.openid.trim();
  }

  const url = new URL(request.url);
  return (url.searchParams.get('openid') || '').trim();
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
    user: {
      openid: user.openid,
      totalMerit: user.totalMerit,
      loginMerit: user.loginMerit,
      lastLoginDate: user.lastLoginDate,
      consecutiveDays: user.consecutiveDays,
      maxConsecutiveDays: user.maxConsecutiveDays,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  const openid = getOpenid(request, request.method === 'POST' ? await request.json().catch(() => ({})) : null);
  if (!openid) {
    return jsonResponse({ ok: false, error: 'openid is required' }, 400);
  }

  const existing = await env.WXMINI.get(openid, 'json');
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
  await env.WXMINI.put(openid, JSON.stringify(result.user));

  return jsonResponse(buildLoginResponse(result));
}
