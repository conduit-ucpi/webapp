import { NextApiRequest } from 'next';
import { generateJwt } from '@coinbase/cdp-sdk/auth';

/**
 * The plumbing every Coinbase CDP route needs: a signed JWT, the end user's real
 * IP, and proof of who is asking.
 *
 * This was extracted from the onramp session-token route when the offramp arrived
 * and needed the same three things. Keeping one copy matters more than the line
 * count: the IP extraction in particular is easy to get subtly wrong behind a
 * proxy, and a second copy that reads `req.socket` first would hand Coinbase the
 * load balancer's address and fail validation only in production.
 */

export const COINBASE_API_HOST = 'api.developer.coinbase.com';

export interface CdpCredentials {
  apiKeyId: string;
  apiKeySecret: string;
}

/** Null when the server has no CDP key configured — callers answer 503, not 500. */
export function getCdpCredentials(): CdpCredentials | null {
  const apiKeyId = process.env.COINBASE_API_KEY_ID;
  const apiKeySecret = process.env.COINBASE_API_KEY_SECRET;
  if (!apiKeyId || !apiKeySecret) return null;
  return { apiKeyId, apiKeySecret };
}

interface CdpRequestOptions {
  credentials: CdpCredentials;
  method: 'GET' | 'POST';
  /** Path on the CDP API including the leading slash, e.g. `/onramp/v1/token`. */
  path: string;
  /** Appended to the URL but NOT signed — see below. */
  query?: Record<string, string>;
  body?: unknown;
}

/**
 * Calls the CDP API with a freshly minted JWT.
 *
 * The JWT is signed over the method and path, so it cannot be reused across
 * endpoints — hence minting one per call rather than caching. Coinbase signs the
 * path WITHOUT its query string, so `query` is kept separate: folding it into
 * `path` produces a signature Coinbase rejects.
 */
export async function cdpRequest({
  credentials,
  method,
  path,
  query,
  body,
}: CdpRequestOptions): Promise<Response> {
  const jwt = await generateJwt({
    apiKeyId: credentials.apiKeyId,
    apiKeySecret: credentials.apiKeySecret,
    requestMethod: method,
    requestHost: COINBASE_API_HOST,
    requestPath: path,
    expiresIn: 120,
  });

  const search = query ? `?${new URLSearchParams(query).toString()}` : '';

  return fetch(`https://${COINBASE_API_HOST}${path}${search}`, {
    method,
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// Coinbase requires the originating user's IP for security validation:
// the quote can only be redeemed by the same client. Behind Caddy, the socket
// address is the proxy, so we must read forwarded headers first.
export function extractClientIp(req: NextApiRequest): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  const xff = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = req.headers['x-real-ip'];
  const xri = Array.isArray(realIp) ? realIp[0] : realIp;
  if (xri) return normalizeIp(xri.trim());

  const socketAddr = req.socket?.remoteAddress;
  if (socketAddr) return normalizeIp(socketAddr);

  return null;
}

function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

export interface UserIdentity {
  userId?: string;
  walletAddress?: string;
  email?: string;
}

/**
 * Who the caller actually is, according to the userservice.
 *
 * Returns null for any failure, so a caller cannot accidentally treat an
 * unreachable userservice as a valid session. The offramp routes lean on the
 * fields here rather than on anything the browser sends: the wallet the funds
 * leave from, and the id Coinbase files the sell order under, both have to be the
 * server's opinion of the user, not the client's claim about them.
 */
export async function fetchIdentity(
  req: NextApiRequest,
  authToken: string
): Promise<UserIdentity | null> {
  if (!process.env.USER_SERVICE_URL) {
    console.error('USER_SERVICE_URL not configured');
    return null;
  }

  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) return null;

    return (await response.json()) as UserIdentity;
  } catch (error) {
    console.error('Identity lookup failed:', error);
    return null;
  }
}

export function isValidEvmAddress(address: unknown): address is string {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}
