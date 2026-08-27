import { NextApiRequest, NextApiResponse } from 'next';
import { extractAuthToken, requireAuth } from '@/utils/api-auth';

/**
 * Forward an authenticated API call to one of the backend services.
 *
 * The marketplace and arbiter surfaces added a dozen routes that differ only in service, path
 * and method (MARKETPLACE_OPENSPEC §15.6e), and every one of them has the same obligations:
 * carry the user's token so the service can scope the answer to them, never leak the API key to
 * the browser, and pass the service's own status through rather than flattening it. Writing that
 * out per route is how one of them quietly ends up without the key, or swallowing a 503 as a 500.
 *
 * ⚠️ The split this preserves matters: you SEND transactions via chainservice (or your own
 *    wallet, funded by it) and you READ marketplace state from contractservice. The UI never
 *    reads the chain for marketplace data, and never asks chainservice for an offer book.
 */
type Service = 'chain' | 'contract' | 'user';

interface ProxyOptions {
  /** Which backend answers this — chainservice does things, contractservice serves reads. */
  service: Service;
  /** Path on that service, including the leading slash. */
  path: string;
  method?: 'GET' | 'POST';
  /** Forwarded verbatim as the request body; omit for GETs. */
  body?: unknown;
  /**
   * Defaults to true. Set false only for a route that is genuinely public — the
   * email verification confirm link is opened from a mailbox, in a browser that
   * has no session and never had one.
   */
  requiresAuth?: boolean;
}

function baseUrlFor(service: Service): string | undefined {
  switch (service) {
    case 'chain':
      return process.env.CHAIN_SERVICE_URL;
    case 'contract':
      return process.env.CONTRACT_SERVICE_URL;
    case 'user':
      return process.env.USER_SERVICE_URL;
  }
}

export async function proxyToService(
  req: NextApiRequest,
  res: NextApiResponse,
  options: ProxyOptions
): Promise<void> {
  const method = options.method || 'GET';
  const baseUrl = baseUrlFor(options.service);

  if (!baseUrl) {
    console.error(`${options.service} service URL is not configured`);
    return void res.status(500).json({ error: 'Service not configured' });
  }

  try {
    const authToken = options.requiresAuth === false ? extractAuthToken(req) : requireAuth(req);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': req.headers.cookie || ''
    };

    // A public route may still carry a session — forward it when there is one, so
    // the service can attribute the call, but never demand it.
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Server-side only: the key authenticates this app to the service and must never be
    // reachable from the browser.
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    const response = await fetch(`${baseUrl}${options.path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined
    });

    const text = await response.text();

    // Pass the service's status through untouched. A 503 from the marketplace endpoints is
    // meaningful — it is the correct state for an environment where the venue is not deployed
    // (§15.6e) — and collapsing it into a 500 would read as a fault instead.
    if (!text) {
      return void res.status(response.status).end();
    }

    try {
      res.status(response.status).json(JSON.parse(text));
    } catch {
      res.status(response.status).json({ error: text.substring(0, 500) });
    }
  } catch (error) {
    console.error(`Proxy to ${options.service}service ${options.path} failed:`, error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/** Reject anything but the one method a route supports. */
export function methodGuard(req: NextApiRequest, res: NextApiResponse, allowed: 'GET' | 'POST'): boolean {
  if (req.method !== allowed) {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

/** Read a single dynamic route segment, rejecting arrays and blanks. */
export function routeParam(req: NextApiRequest, name: string): string | null {
  const value = req.query[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
