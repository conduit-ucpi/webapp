import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Forward Set-Cookie header(s) from a backend fetch Response to the browser.
 *
 * The userservice sets AUTH-TOKEN with `Domain=<COOKIE_DOMAIN>`, which on any
 * deployed backend is a `conduit-ucpi.com` value. When the webapp runs on
 * http://localhost with USER_SERVICE_URL pointing at a remote backend, the
 * browser rejects a cookie whose Domain doesn't cover `localhost`, so the
 * session cookie never sticks (verify succeeds but /session 401s) and, on
 * sign-out, the clear-cookie can't match the stored one.
 *
 * For localhost hosts we strip the Domain attribute so the cookie becomes
 * host-only and is accepted. On any real host the cookie is forwarded
 * unchanged, so production behaviour is identical.
 */
export function forwardSetCookie(
  backendResponse: Response,
  req: NextApiRequest,
  res: NextApiResponse
): void {
  // getSetCookie() preserves multiple Set-Cookie headers (undici, Node 18+);
  // fall back to get() for older runtimes.
  const cookies =
    typeof backendResponse.headers.getSetCookie === 'function'
      ? backendResponse.headers.getSetCookie()
      : ([backendResponse.headers.get('set-cookie')].filter(Boolean) as string[])

  if (!cookies.length) return

  const host = (req.headers.host || '').split(':')[0]
  const isLocalhost = host === 'localhost' || host === '127.0.0.1'

  const forwarded = isLocalhost
    ? cookies.map((cookie) => cookie.replace(/;\s*Domain=[^;]+/i, ''))
    : cookies

  res.setHeader('Set-Cookie', forwarded)
}
