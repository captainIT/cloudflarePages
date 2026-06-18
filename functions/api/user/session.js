import { codeToOpenid } from '../../_shared/wechat.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';

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
  const code = (body.code || '').trim();
  if (!code) {
    return jsonResponse({ ok: false, error: 'code is required' }, 400);
  }

  try {
    const session = await codeToOpenid(env, code);
    return jsonResponse({
      ok: true,
      openid: session.openid,
      unionid: session.unionid,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || 'failed to exchange code',
    }, 400);
  }
}
