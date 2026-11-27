import type { NextApiRequest } from 'next';

/**
 * Limits for the public forms that send us email (white-label requests, in-app feedback): a
 * per-address rate limit and the caller's address. In memory: per instance, which is enough here.
 */
export function rateLimiter(perWindow: number, windowMs: number) {
  const recent = new Map<string, number[]>();
  return function allow(address: string, now = Date.now()): boolean {
    const times = (recent.get(address) ?? []).filter((t) => now - t < windowMs);
    if (times.length >= perWindow) {
      recent.set(address, times);
      return false;
    }
    times.push(now);
    recent.set(address, times);
    return true;
  };
}

export function clientAddress(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}
