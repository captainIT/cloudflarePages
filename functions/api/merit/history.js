import { MERIT_TYPE_LABELS } from '../../_shared/merit.js';
import { getOpenidFromRequest } from '../../_shared/openid.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';
import {
  countMeritEvents,
  getMeritEvents,
  getMeritSummaryByType,
  getUserByOpenid,
} from '../../_shared/users-db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function buildSummary(user, byType) {
  return {
    totalMerit: user?.totalMerit || 0,
    loginMerit: user?.loginMerit || 0,
    shareMerit: user?.shareMerit || 0,
    byType: Object.entries(byType).map(([type, stats]) => ({
      type,
      label: MERIT_TYPE_LABELS[type] || type,
      count: stats.count,
      total: stats.total,
    })),
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

  const url = new URL(request.url);
  const limit = Math.min(
    parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0);
  const page = Math.floor(offset / limit) + 1;

  const [user, events, byType, totalCount] = await Promise.all([
    getUserByOpenid(env.DB, openid),
    getMeritEvents(env.DB, openid, { limit, offset }),
    getMeritSummaryByType(env.DB, openid),
    countMeritEvents(env.DB, openid),
  ]);

  const enrichedEvents = events.map((event) => ({
    ...event,
    label: event.description || MERIT_TYPE_LABELS[event.type] || event.type,
  }));

  return jsonResponse({
    ok: true,
    summary: buildSummary(user, byType),
    events: enrichedEvents,
    page,
    limit,
    offset,
    totalCount,
    hasMore: offset + events.length < totalCount,
  });
}
