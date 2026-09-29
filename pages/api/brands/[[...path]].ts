import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Proxy to the white-label service (../whitelabelservice).
 *
 * The browser fetches brands from `${API_BASE}/api/brands/...`, which lands here, and this
 * forwards to WHITELABEL_SERVICE_URL — `http://whitelabelservice-prod:8985` on cherry,
 * `http://whitelabelservice:8985` on test. The service is reached only through the webapp so each
 * environment's webapp talks to its own service, set by that environment's variable like every
 * other backend.
 *
 * Unlike lib/server/serviceProxy.ts this is a byte-for-byte pass-through rather than JSON in,
 * JSON out, because it also carries logos and font files, the service's caching headers and
 * 304s, and the admin writes (PUT, multipart uploads) scripts/brands/*.mjs make.
 *
 * What it deliberately does NOT forward:
 *  - cookies or the session: brands are public, and the service never needs to know who asked;
 *  - this app's own X_API_KEY: the service's writes are guarded by its own admin key, which only
 *    an operator holds and sends. A caller's X-API-Key is passed through as-is, never added.
 */

export const config = {
  api: {
    // The body is forwarded untouched — JSON configs and multipart uploads alike.
    bodyParser: false,
    // Assets are capped at 1 MB by the service; this only stops Next warning about them.
    responseLimit: '2mb',
  },
};

/** Request headers worth passing on. Everything else — cookies included — stays here. */
const FORWARD_REQUEST_HEADERS = ['content-type', 'x-api-key', 'if-none-match', 'accept'];

/** Response headers the service sets on purpose; see its AssetController for why each matters. */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'content-security-policy',
  'x-content-type-options',
  'access-control-allow-origin',
  'cross-origin-resource-policy',
];

/** Brand ids, asset ids and the word `assets`. Nothing that could walk out of /api/brands. */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_BODY_BYTES = 1_100_000;

function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too-large'));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const baseUrl = process.env.WHITELABEL_SERVICE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    // 503, not 500: the frontend reads it as "service unreachable" and keeps the bundled snapshot.
    console.error('WHITELABEL_SERVICE_URL is not configured');
    return void res.status(503).json({ error: 'White-label service not configured' });
  }

  const raw = req.query.path;
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Zero segments is the admin brand list (GET /api/brands), hence the optional catch-all.
  if (segments.length > 4 || !segments.every((s) => SEGMENT.test(s))) {
    return void res.status(404).json({ error: 'Not found' });
  }

  const method = req.method || 'GET';
  if (!['GET', 'HEAD', 'PUT', 'POST', 'DELETE'].includes(method)) {
    return void res.status(405).json({ error: 'Method not allowed' });
  }

  const headers: Record<string, string> = {};
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }

  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await readBody(req);
    } catch {
      return void res.status(413).json({ error: 'Request too large' });
    }
  }

  const url = [`${baseUrl}/api/brands`, ...segments.map(encodeURIComponent)].join('/');

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: body && body.length ? new Uint8Array(body) : undefined,
    });

    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.status(upstream.status);

    if (upstream.status === 204 || upstream.status === 304 || method === 'HEAD') {
      return void res.end();
    }
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error(`White-label proxy ${method} ${url} failed:`, error);
    res.status(502).json({ error: 'White-label service unreachable' });
  }
}
