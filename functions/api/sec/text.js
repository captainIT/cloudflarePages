import { resolveOpenid } from '../../_shared/openid.js';
import { handleOptions, jsonResponse } from '../../_shared/response.js';
import { checkTextContent, ILLEGAL_CONTENT_MESSAGE } from '../../_shared/sec-check.js';

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
  const content = (body.content || '').trim();
  if (!content) {
    return jsonResponse({ ok: true, safe: true });
  }

  let openid = '';
  try {
    openid = await resolveOpenid(request, body, env);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || 'failed to resolve openid',
    }, 400);
  }

  try {
    const result = await checkTextContent(env, content, openid);
    if (!result.safe) {
      return jsonResponse({
        ok: false,
        safe: false,
        error: ILLEGAL_CONTENT_MESSAGE,
      }, 400);
    }

    return jsonResponse({ ok: true, safe: true });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || 'text security check failed',
    }, 500);
  }
}
