import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

/**
 * Forward an authenticated API call to one of the backend services.
 *
 * The marketplace and arbiter surfaces added a dozen routes that differ only in service, path
 * and method (MARKETPLACE_OPENSPEC §15.6e), and every one of them has the same obligations:
 * carry the user's token so the service can scope the answer to them, never leak the API key to
 * the browser, and pass the service's own status through rather than flattening it. Writing that
 * out per route is how one of them quietly ends up without the key, or swallowing a 503 as a 500.
 *
 * ⚠️ THE BROWSER NEVER TALKS TO A NODE. Everything the UI needs from the chain comes from
 *    chainservice, which reads it once and caches it — a page listing twenty offers must cost
 *    one request, not twenty RPC calls from every browser showing it. The split by service:
 *
 *      chainservice     SENDS transactions (or funds your own wallet to send them), and READS
 *                       chain-derived facts — a vault's balance, an escrow's payout — cached,
 *                       and invalidated when it relays the call that changed them.
 *      contractservice  serves STORED marketplace state: the offer book, folded from the
 *                       events chainservice indexes and pushes to it.
 *      resultservice    the PUBLICLY-CALLABLE read of chain-derived contract data — state and
 *                       maturity — for contracts the caller does not own, which is the ordinary
 *                       case for an LP looking at escrows they have bid on.
 *
 *    Still true, and the reason the second and third exist: never ask chainservice for an offer
 *    book, and never reach into a user's own contract store to describe someone else's escrow.
 *
 * ⚠️ resultservice IS NOT ROUTED THROUGH THIS HELPER, deliberately. Being public is the whole
 *    point of it: it exposes only fields anyone may see, so it needs no user token to scope an
 *    answer and no API key to prove who is asking. Routing it through here would attach
 *    credentials to a call that must not depend on them, and would make a public read fail for
 *    a signed-out user. See pages/api/marketplace/escrow-states.ts.
 */
type Service = 'chain' | 'contract';

interface ProxyOptions {
  /** Which backend answers this — chainservice does things, contractservice serves reads. */
  service: Service;
  /** Path on that service, including the leading slash. */
  path: string;
  method?: 'GET' | 'POST';
  /** Forwarded verbatim as the request body; omit for GETs. */
  body?: unknown;
}

function baseUrlFor(service: Service): string | undefined {
  return service === 'chain' ? process.env.CHAIN_SERVICE_URL : process.env.CONTRACT_SERVICE_URL;
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
    const authToken = requireAuth(req);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

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
