import type { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { requireAdmin } from '@/lib/server/requireAdmin';

/**
 * One email, to one address, for the admin bulk emailer (/admin/email). The page loops over its
 * list and calls this once per address, five seconds apart; nothing here batches or schedules.
 *
 * ⚠️ ADMIN ON BOTH HOPS. requireAdmin asks userservice before anything is sent, and the admin's own
 *    session is what is forwarded: emailservice's /api/email/send checks again that its caller
 *    is an admin. No service key is used, so this route can do nothing the admin could not.
 *
 * The body arrives as plain text and is escaped here: blank lines make paragraphs, single line
 * breaks stay as breaks. No HTML the admin types reaches the email as markup.
 */

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const authToken = await requireAdmin(req, res);
  if (!authToken) return;

  const base = process.env.EMAIL_SERVICE_URL;
  if (!base) return res.status(503).json({ error: 'EMAIL_SERVICE_URL is not set on this server.' });

  const { to, subject, body } = req.body ?? {};
  if (typeof to !== 'string' || !EMAIL.test(to.trim())) {
    return res.status(400).json({ error: 'Not a valid email address.' });
  }
  if (typeof subject !== 'string' || !subject.trim() || subject.length > MAX_SUBJECT || /[\r\n]/.test(subject)) {
    return res.status(400).json({ error: `Subject is required, one line, at most ${MAX_SUBJECT} characters.` });
  }
  if (typeof body !== 'string' || !body.trim() || body.length > MAX_BODY) {
    return res.status(400).json({ error: `Body is required, at most ${MAX_BODY} characters.` });
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        Cookie: req.headers.cookie || '',
      },
      body: JSON.stringify({ to: to.trim(), subject: subject.trim(), content: plainTextToHtml(body), isHtml: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return res.status(200).json({ sent: true, messageId: payload.messageId ?? null });
    const message = typeof payload.message === 'string' ? payload.message : `emailservice answered ${response.status}`;
    // 400 and 403 are emailservice's verdict on this request; anything else is its failure.
    return res.status(response.status === 400 || response.status === 403 ? response.status : 502).json({ error: message });
  } catch (error) {
    console.error('Bulk email could not reach emailservice:', error);
    return res.status(502).json({ error: 'Could not reach emailservice.' });
  }
}
