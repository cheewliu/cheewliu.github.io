/**
 * Cloudflare Worker — Anthropic API proxy for cheewliu.github.io
 *
 * - Injects ANTHROPIC_API_KEY from Cloudflare secret (never in code)
 * - Enforces CORS (portfolio domain + localhost dev)
 * - Rate limits: 3 requests per IP per hour via KV
 */

const ALLOWED_ORIGINS = [
  'https://cheewliu.github.io',
  'https://www.cheewliu.github.io',
];

const RATE_LIMIT_MAX    = 3;
const RATE_LIMIT_WINDOW = 60 * 60; // seconds

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Allow localhost in dev (any port)
    const isAllowed =
      ALLOWED_ORIGINS.includes(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return buildResponse(null, 204, isAllowed ? origin : null);
    }

    if (request.method !== 'POST') {
      return buildResponse(JSON.stringify({ error: 'Method not allowed' }), 405, isAllowed ? origin : null);
    }

    if (!isAllowed) {
      return buildResponse(JSON.stringify({ error: 'Forbidden' }), 403, null);
    }

    // Rate limiting via KV
    const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rate:${ip}`;
    const now = Math.floor(Date.now() / 1000);

    const stored   = await env.RATE_LIMIT.get(key, { type: 'json' });
    const requests = Array.isArray(stored)
      ? stored.filter(ts => ts > now - RATE_LIMIT_WINDOW)
      : [];

    if (requests.length >= RATE_LIMIT_MAX) {
      return buildResponse(
        JSON.stringify({ error: 'Rate limit exceeded — max 3 requests per hour.' }),
        429,
        origin
      );
    }

    requests.push(now);
    await env.RATE_LIMIT.put(key, JSON.stringify(requests), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });

    // Proxy to Anthropic — API key injected from secret, never exposed
    try {
      const body = await request.text();

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
      });

      const text = await upstream.text();
      return buildResponse(text, upstream.status, origin);

    } catch (err) {
      return buildResponse(
        JSON.stringify({ error: 'Proxy error', detail: err.message }),
        502,
        origin
      );
    }
  },
};

function buildResponse(body, status, origin) {
  const headers = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(body, { status, headers });
}
