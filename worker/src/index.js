/**
 * Cloudflare Worker — API proxy for cheewliu.github.io
 *
 * Routes:
 *   GET  /github  — GitHub public repos proxy (uses GITHUB_TOKEN secret)
 *   POST /        — Anthropic Claude API proxy (uses ANTHROPIC_API_KEY secret)
 *
 * - Injects secrets from Cloudflare (never exposed to the browser)
 * - Enforces CORS (portfolio domain + localhost dev)
 * - Rate limits Claude calls: 50 requests per IP per hour via KV
 */

const ALLOWED_ORIGINS = [
  'https://cheewliu.github.io',
  'https://www.cheewliu.github.io',
];

const RATE_LIMIT_MAX    = 50;        // raised: 50 Claude calls/IP/hour
const RATE_LIMIT_WINDOW = 60 * 60;  // seconds
const MAX_BODY_BYTES    = 16_000;   // ~16 KB max request body

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    const isAllowed =
      ALLOWED_ORIGINS.includes(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return buildResponse(null, 204, isAllowed ? origin : null);
    }

    if (!isAllowed) {
      return buildResponse(JSON.stringify({ error: 'Forbidden' }), 403, null);
    }

    // ── GET /github — GitHub repos proxy ──────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/github') {
      try {
        // Lock to portfolio owner only — don't allow proxying arbitrary users
        const username = 'cheewliu';
        const perPage  = Math.min(parseInt(url.searchParams.get('per_page') || '12'), 30);

        const headers = {
          'Accept':     'application/vnd.github+json',
          'User-Agent': 'cheewliu-portfolio-worker',
        };
        if (env.GITHUB_TOKEN) {
          headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;
        }

        const ghRes  = await fetch(
          `https://api.github.com/users/${username}/repos?sort=updated&per_page=${perPage}&type=public`,
          { headers }
        );
        const text = await ghRes.text();
        return buildResponse(text, ghRes.status, origin);

      } catch (err) {
        return buildResponse(
          JSON.stringify({ error: 'GitHub proxy error', detail: err.message }),
          502,
          origin
        );
      }
    }

    // ── POST / — Anthropic Claude proxy ───────────────────────────────────
    if (request.method !== 'POST') {
      return buildResponse(JSON.stringify({ error: 'Method not allowed' }), 405, origin);
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
        JSON.stringify({ error: `Rate limit exceeded — max ${RATE_LIMIT_MAX} requests per hour.` }),
        429,
        origin
      );
    }

    requests.push(now);
    await env.RATE_LIMIT.put(key, JSON.stringify(requests), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });

    // Proxy to Anthropic
    try {
      // Reject oversized bodies
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_BODY_BYTES) {
        return buildResponse(JSON.stringify({ error: 'Request too large.' }), 413, origin);
      }
      const body = await request.text();
      if (body.length > MAX_BODY_BYTES) {
        return buildResponse(JSON.stringify({ error: 'Request too large.' }), 413, origin);
      }

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
    'Content-Type':                  'application/json',
    'Access-Control-Allow-Methods':  'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':  'Content-Type',
    'Access-Control-Max-Age':        '86400',
    // Security headers
    'X-Content-Type-Options':        'nosniff',
    'X-Frame-Options':               'DENY',
    'Referrer-Policy':               'strict-origin-when-cross-origin',
    'Strict-Transport-Security':     'max-age=31536000; includeSubDomains',
    'Cache-Control':                 'no-store',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(body, { status, headers });
}
