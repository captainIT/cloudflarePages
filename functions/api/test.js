const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key') || 'test';

  if (request.method === 'POST') {
    const payload = await request.json();
    await env.WXMINI.put(key, JSON.stringify(payload));
    return new Response(JSON.stringify({ ok: true, key, saved: payload }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const value = await env.WXMINI.get(key, 'json');

  const body = {
    ok: true,
    message: 'this is test',
    method: request.method,
    path: url.pathname,
    key,
    value,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: JSON_HEADERS,
  });
}
