const JSCODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

export async function codeToOpenid(env, code) {
  const appId = env.WX_APP_ID;
  const appSecret = env.WX_APP_SECRET;

  if (!appId) {
    throw new Error('WX_APP_ID is not configured');
  }

  if (!appSecret) {
    throw new Error('WX_APP_SECRET is not configured');
  }

  const url = new URL(JSCODE2SESSION_URL);
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.errcode) {
    throw new Error(data.errmsg || `WeChat auth failed (${data.errcode})`);
  }

  if (!data.openid) {
    throw new Error('WeChat auth response missing openid');
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key,
    unionid: data.unionid || null,
  };
}
