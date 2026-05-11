import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Lightweight telemetry endpoint for auth failures.
 *
 * Goal: quantify how often Reown's social-login embedded wallet fails
 * because of magiclabs.com being blocked at DNS / network level. We log
 * just enough to count + categorize, with no PII (no wallet address,
 * no email, no IP).
 *
 * Stored output is just a structured log line for now — the build/test
 * environment captures container stdout, so we can grep aggregate counts
 * without needing a metrics pipeline. If the volume justifies it later,
 * we can swap this for a real sink.
 */

interface AuthFailureBody {
  kind?: 'wallet-signing' | 'network' | 'unknown' | 'magic-blocked';
  context?: 'pre-flight' | 'siwe-verify' | 'request-authentication';
  // Optional, short, free-form classifier message — never include user input.
  message?: string;
}

const ALLOWED_KINDS = new Set([
  'wallet-signing',
  'network',
  'unknown',
  'magic-blocked',
]);

const ALLOWED_CONTEXTS = new Set([
  'pre-flight',
  'siwe-verify',
  'request-authentication',
]);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as AuthFailureBody;
  const kind = ALLOWED_KINDS.has(body.kind as string) ? body.kind : 'unknown';
  const context = ALLOWED_CONTEXTS.has(body.context as string)
    ? body.context
    : 'unknown';

  const userAgent = (req.headers['user-agent'] ?? '').toString().slice(0, 200);

  // Cap message length to keep logs sane and prevent log injection.
  const message =
    typeof body.message === 'string' ? body.message.slice(0, 200) : undefined;

  // Single structured line, easy to grep / aggregate from container logs.
  console.log('[telemetry] auth-failure', JSON.stringify({
    kind,
    context,
    message,
    userAgent,
    ts: Date.now(),
  }));

  res.status(204).end();
}
