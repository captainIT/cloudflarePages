import { handleOptions, jsonResponse } from '../../_shared/response.js';
import { checkImageContent, ILLEGAL_CONTENT_MESSAGE } from '../../_shared/sec-check.js';

function getImageContentType(file) {
  if (file?.type) {
    return file.type;
  }
  return 'image/jpeg';
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

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonResponse({ ok: false, error: 'invalid form data' }, 400);
  }

  const file = formData.get('media') || formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return jsonResponse({ ok: false, error: 'image file is required' }, 400);
  }

  try {
    const imageBuffer = await file.arrayBuffer();
    const result = await checkImageContent(env, imageBuffer, getImageContentType(file));
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
      error: error.message || 'image security check failed',
    }, 500);
  }
}
