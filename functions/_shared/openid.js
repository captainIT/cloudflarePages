import { codeToOpenid } from './wechat.js';

export function getOpenidFromRequest(request, body) {
  if (body?.openid) {
    return body.openid.trim();
  }

  const url = new URL(request.url);
  return (url.searchParams.get('openid') || '').trim();
}

export async function resolveOpenid(request, body, env) {
  if (body?.code) {
    const session = await codeToOpenid(env, body.code.trim());
    return session.openid;
  }

  return getOpenidFromRequest(request, body);
}
