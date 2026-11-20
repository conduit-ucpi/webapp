import type { NextApiRequest, NextApiResponse } from 'next';
import { extractAuthToken } from '@/utils/api-auth';

/**
 * Lets an admin route go on only for a signed-in admin, as userservice sees them.
 *
 * ⚠️ EVERY HOP CHECKS, NOT JUST THE LAST ONE. contractservice and chainservice refuse a
 *    non-admin on their admin endpoints themselves, and until 2026-11-20 three routes here
 *    leaned on that alone: they forwarded whatever arrived, cookies and all, and let the
 *    service say no. That held, but it left one check between an anonymous caller and the
 *    unredacted contract database or a dispute resolution, and it was reported to us as an
 *    authentication bypass by somebody who could not see the services. A route under an admin
 *    path asks userservice itself before it touches anything.
 *
 * Answers the request (401 no usable session, 403 not an admin) and returns null when the
 * caller may not continue; otherwise returns the token to forward. A token being present is
 * not enough: it is whatever the caller sent.
 */
export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const authToken = extractAuthToken(req);
  if (!authToken) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  let identity: { userType?: string } | null = null;
  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: { Authorization: `Bearer ${authToken}`, Cookie: req.headers.cookie || '' },
    });
    identity = response.ok ? await response.json() : null;
  } catch (error) {
    console.error('Admin check could not reach userservice:', error);
  }

  if (!identity) {
    res.status(401).json({ error: 'Authentication failed' });
    return null;
  }
  if (identity.userType !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return authToken;
}
