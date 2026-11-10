import type { NextApiRequest } from 'next';
import { MAX_CONSOLE_ENTRIES, MAX_CONSOLE_ENTRY, MAX_DESCRIPTION, type CreateRecordingRequest } from '@/lib/problemReport';
import type { SignedInAccount } from '@/lib/server/signedInAccount';

/**
 * The record kept beside each "Report a problem" video (recordings/<id>/record.json), and the
 * message that tells us one has arrived.
 *
 * ⚠️ TWO KINDS OF FACT, KEPT APART. `account` is who userservice says the session belongs to.
 *    `reported` is what the browser said about itself: the page, the viewport, its console, the
 *    wallet it has connected. Anyone can send anything there, so it is cleaned and labelled, and
 *    nothing decides anything by it.
 */
export interface RecordingRecord {
  id: string;
  createdAt: string;
  /** uploading: URL(s) handed out. uploaded: the video is in the bucket. notified: we were told. */
  status: 'uploading' | 'uploaded' | 'notified';
  completedAt?: string;
  video: { key: string; contentType: string; size: number };
  upload: { kind: 'single' } | { kind: 'multipart'; uploadId: string; assembled?: boolean };
  source: 'recorder' | 'upload';
  description: string;
  contactEmail: string;
  account: SignedInAccount;
  reported: {
    pageUrl: string | null;
    route: string | null;
    viewport: { width: number; height: number } | null;
    platform: string | null;
    appVersion: string | null;
    clientTime: string | null;
    timezone: string | null;
    connectedWallet: string | null;
    replayId: string | null;
    console: string[];
  };
  request: { userAgent: string | null; country: string | null; serverVersion: string };
}

export const RECORDING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** One line of printable text, cut to size, or null. */
const line = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
  return cleaned || null;
};

const matching = (value: unknown, shape: RegExp): string | null =>
  typeof value === 'string' && shape.test(value) ? value : null;

const dimension = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 100_000 ? value : null;

const header = (req: NextApiRequest, name: string): string | null => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
};

/** What the browser said about the moment, cleaned field by field. Anything else it sent is dropped. */
export function cleanReported(body: Partial<CreateRecordingRequest>): RecordingRecord['reported'] {
  const width = dimension(body.viewport?.width);
  const height = dimension(body.viewport?.height);
  return {
    pageUrl: line(body.pageUrl, 2000),
    route: line(body.route, 200),
    viewport: width && height ? { width, height } : null,
    platform: line(body.platform, 100),
    appVersion: matching(body.appVersion, /^[A-Za-z0-9._-]{1,64}$/),
    clientTime: matching(body.clientTime, /^\d{4}-\d{2}-\d{2}T[\d:.]{8,12}Z$/),
    timezone: matching(body.timezone, /^[A-Za-z0-9_+\-/]{1,64}$/),
    connectedWallet: matching(body.connectedWallet, /^0x[0-9a-fA-F]{40}$/),
    replayId: matching(body.replayId, /^[A-Za-z0-9_-]{1,100}$/),
    console: (Array.isArray(body.console) ? body.console : [])
      .slice(-MAX_CONSOLE_ENTRIES)
      .map((entry) => line(entry, MAX_CONSOLE_ENTRY))
      .filter((entry): entry is string => entry !== null),
  };
}

/** The free text, with line breaks kept and control characters gone. */
export const cleanDescription = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_DESCRIPTION) : '';

export function requestFacts(req: NextApiRequest): RecordingRecord['request'] {
  const country = header(req, 'cf-ipcountry');
  return {
    userAgent: line(header(req, 'user-agent'), 500),
    country: country && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null,
    serverVersion: process.env.GIT_SHA || 'unknown',
  };
}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The message for our inbox, sent through emailservice's in-app feedback endpoint (which adds the
 * page, the account and the browser from its own fields). Both links work for seven days.
 */
export function notificationMessage(record: RecordingRecord, videoUrl: string, recordUrl: string): string {
  const r = record.reported;
  return [
    'PROBLEM REPORT WITH A SCREEN RECORDING',
    '',
    'What they were trying to do:',
    record.description || '(nothing written)',
    '',
    'Recording (this link works for 7 days):',
    videoUrl,
    '',
    'Everything captured with it, including the console (7 days):',
    recordUrl,
    '',
    `Recording id: ${record.id}`,
    `User id: ${record.account.userId ?? '(not signed in)'}`,
    `Connected wallet, as the page reported it: ${r.connectedWallet ?? '(none)'}`,
    `Route: ${r.route ?? '(not given)'}`,
    `Video: ${megabytes(record.video.size)}, ${record.video.contentType}, ${record.source === 'recorder' ? 'recorded in the page' : 'uploaded file'}`,
    `Viewport: ${r.viewport ? `${r.viewport.width}x${r.viewport.height}` : '(not given)'}, platform ${r.platform ?? '(not given)'}`,
    `App version: ${r.appVersion ?? '(not given)'} (server ${record.request.serverVersion})`,
    `Their time: ${r.clientTime ?? '(not given)'} in ${r.timezone ?? '(not given)'}, country ${record.request.country ?? 'unknown'}`,
    `Console lines captured: ${r.console.length}`,
    `Session replay: ${r.replayId ?? '(none)'}`,
  ].join('\n');
}

/** Tell us, through emailservice. True when it took the message. Never throws. */
export async function notify(record: RecordingRecord, videoUrl: string, recordUrl: string): Promise<boolean> {
  const base = process.env.EMAIL_SERVICE_URL;
  const key = process.env.TO_EMAILSERVICE_API_KEY;
  if (!base || !key) return false;
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/email/in-app-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({
        contactEmail: record.contactEmail,
        message: notificationMessage(record, videoUrl, recordUrl),
        pageUrl: record.reported.pageUrl,
        walletAddress: record.account.walletAddress,
        accountEmail: record.account.accountEmail,
        userAgent: record.request.userAgent,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const notificationsConfigured = (): boolean => !!process.env.EMAIL_SERVICE_URL && !!process.env.TO_EMAILSERVICE_API_KEY;
