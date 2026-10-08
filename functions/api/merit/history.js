import { getOpenidFromRequest } from '../../_shared/openid.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';
import { getUserByOpenid } from '../../_shared/users-db.js';

function buildSummary(user) {
  const loginMerit = user?.loginMerit || 0;
  const streakMerit = user?.streakMerit || 0;
  const shareMerit = user?.shareMerit || 0;

  return {
    totalMerit: user?.totalMerit || 0,
    loginMerit,
    streakMerit,
    shareMerit,
    consecutiveDays: user?.consecutiveDays || 0,
    maxConsecutiveDays: user?.maxConsecutiveDays || 0,
    lastLoginDate: user?.lastLoginDate || null,
    lastShareDate: user?.lastShareDate || null,
    byType: [
      { type: 'login', label: '每日登录', total: Math.max(loginMerit - streakMerit, 0) },
      { type: 'login_streak', label: '连续登录奖励', total: streakMerit },
      { type: 'share', label: '分享好友', total: shareMerit },
    ],
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method not allowed' }, 405);
  }

  const openid = getOpenidFromRequest(request);
  if (!openid) {
    return jsonResponse({ ok: false, error: 'openid is required' }, 400);
  }

  if (!env.DB) {
    return jsonResponse({ ok: false, error: 'database not configured' }, 500);
  }

  const user = await getUserByOpenid(env.DB, openid);

  return jsonResponse({
    ok: true,
    summary: buildSummary(user),
  });
}
