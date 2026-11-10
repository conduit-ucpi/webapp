import type { NextApiRequest } from 'next';
import { extractAuthToken } from '@/utils/api-auth';

export interface SignedInAccount {
  userId: string | null;
  walletAddress: string | null;
  accountEmail: string | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Who is signed in, for the public forms that tell us (feedback, problem reports): asked of
 * userservice with the visitor's own session, never taken from the browser, so nobody can send us
 * something that claims to be from someone else's account. Nulls when there is no session.
 * Never throws.
 */
export async function signedInAccount(req: NextApiRequest): Promise<SignedInAccount> {
  const none = { userId: null, walletAddress: null, accountEmail: null };
  const base = process.env.USER_SERVICE_URL;
  const token = extractAuthToken(req);
  if (!base || (!token && !req.headers.cookie)) return none;
  try {
    // Only the visitor's credentials: userservice refuses lookups that carry forwarded headers.
    const headers: Record<string, string> = { Cookie: req.headers.cookie || '' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base.replace(/\/$/, '')}/api/user/identity`, { headers });
    if (!response.ok) return none;
    const identity = await response.json();
    return {
      userId: text(identity?.userId),
      walletAddress: text(identity?.walletAddress),
      accountEmail: text(identity?.email),
    };
  } catch {
    return none;
  }
}
