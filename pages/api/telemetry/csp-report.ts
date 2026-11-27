import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * Where browsers send what the Content-Security-Policy (config/csp.js) blocked or would have, as one
 * log line, so Grafana shows what enforcing the policy would break.
 *
 * ⚠️ PUBLIC, AND IT PROVES LITTLE. Anyone can post anything, so a line is a claim from a browser.
 *
 * Only origins and paths are logged: query strings can hold payment details and analytics ids.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } },
};

/** Past this, the browser still gets its 204 and no line is written. Per address per hour. */
export const allow = rateLimiter(200, 60 * 60 * 1000);

const EXTENSION_SOURCE = /^(chrome|moz|safari|safari-web)-extension:/;
const KEYWORD_SOURCES = new Set(['inline', 'eval', 'wasm-eval', 'data', 'blob', 'self']);

const httpUrl = (value: unknown): URL | null => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return /^(https?|wss?):$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

/** Browsers send application/csp-report, which Next hands over unparsed. */
function reportFrom(body: unknown): Record<string, unknown> | null {
  let parsed = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const report = (parsed as { 'csp-report'?: unknown } | null)?.['csp-report'];
  return report && typeof report === 'object' ? (report as Record<string, unknown>) : null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const report = reportFrom(req.body);
  if (!report) return res.status(400).json({ error: 'Not a CSP report' });

  const fromExtension =
    typeof report['source-file'] === 'string' && EXTENSION_SOURCE.test(report['source-file']);

  if (!fromExtension && allow(clientAddress(req))) {
    const directive = report['effective-directive'] ?? report['violated-directive'];
    const blocked = report['blocked-uri'];
    const blockedHost = httpUrl(blocked);
    const page = httpUrl(report['document-uri']);
    const name = typeof directive === 'string' && /^[a-z-]{1,40}/.exec(directive)?.[0];
    const source = blockedHost
      ? blockedHost.origin
      : typeof blocked === 'string' && KEYWORD_SOURCES.has(blocked)
        ? blocked
        : 'other';
    console.log(
      `CSP VIOLATION ${name || 'unknown'}: blocked ${source} ` +
        `on ${page ? `${page.origin}${page.pathname.slice(0, 120)}` : 'unknown'}`
    );
  }
  res.status(204).end();
}
