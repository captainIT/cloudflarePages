const TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const MSG_SEC_CHECK_URL = 'https://api.weixin.qq.com/wxa/msg_sec_check';
const IMG_SEC_CHECK_URL = 'https://api.weixin.qq.com/wxa/img_sec_check';

export const ILLEGAL_CONTENT_MESSAGE = '发布的内容含违规信息';

let cachedToken = '';
let tokenExpiresAt = 0;

export async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const appId = env.WX_APP_ID;
  const appSecret = env.WX_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('WeChat credentials are not configured');
  }

  const url = new URL(TOKEN_URL);
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.errcode) {
    throw new Error(data.errmsg || `Failed to get access token (${data.errcode})`);
  }

  if (!data.access_token) {
    throw new Error('WeChat token response missing access_token');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + Math.max((data.expires_in || 7200) - 300, 60) * 1000;
  return cachedToken;
}

function isRiskyTextResult(data) {
  if (data.errcode === 87014) {
    return true;
  }

  const suggest = data.result?.suggest;
  return suggest === 'risky' || suggest === 'review';
}

export async function checkTextContent(env, content, openid = '') {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { safe: true };
  }

  const accessToken = await getAccessToken(env);
  const payload = openid
    ? {
      openid,
      scene: 1,
      version: 2,
      content: trimmed,
    }
    : { content: trimmed };

  const response = await fetch(`${MSG_SEC_CHECK_URL}?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (data.errcode === 0) {
    return { safe: !isRiskyTextResult(data) };
  }

  if (openid && data.errcode === 61010) {
    const fallbackResponse = await fetch(`${MSG_SEC_CHECK_URL}?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    });
    const fallbackData = await fallbackResponse.json();
    if (fallbackData.errcode === 0) {
      return { safe: !isRiskyTextResult(fallbackData) };
    }
    throw new Error(fallbackData.errmsg || `Text security check failed (${fallbackData.errcode})`);
  }

  if (data.errcode === 87014) {
    return { safe: false };
  }

  throw new Error(data.errmsg || `Text security check failed (${data.errcode})`);
}

export async function checkImageContent(env, imageBuffer, contentType = 'image/jpeg') {
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    throw new Error('image file is required');
  }

  const accessToken = await getAccessToken(env);
  const formData = new FormData();
  formData.append('media', new Blob([imageBuffer], { type: contentType }), 'image.jpg');

  const response = await fetch(`${IMG_SEC_CHECK_URL}?access_token=${accessToken}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (data.errcode === 0) {
    return { safe: true };
  }

  if (data.errcode === 87014) {
    return { safe: false };
  }

  throw new Error(data.errmsg || `Image security check failed (${data.errcode})`);
}
