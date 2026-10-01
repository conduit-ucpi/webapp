/**
 * A white-label partner's request, as the /white-label form collects it: their own brand config
 * JSON, their contact address and their domains, turned into the email that asks us to set it up.
 *
 * Pure, so the form and its tests agree on exactly what is sent.
 */

export const WHITE_LABEL_INBOX = 'white-label@stabledrop.me';

export interface WhiteLabelRequest {
  contactName: string;
  /** The partner's own address: the only way we can reply. Required. */
  contactEmail: string;
  /** Hostnames, separated by commas, spaces or new lines. At least one. */
  productionDomains: string;
  testDomains: string;
  /** The whole brand config, as JSON. Required. */
  configJson: string;
  notes: string;
}

export const EMPTY_REQUEST: WhiteLabelRequest = {
  contactName: '',
  contactEmail: '',
  productionDomains: '',
  testDomains: '',
  configJson: '',
  notes: '',
};

const BRAND_ID = /^[a-z0-9-]{2,32}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "Https://WWW.Example.com/shop, example.com" → ["www.example.com", "example.com"] */
export function parseDomains(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, ''))
    .filter(Boolean);
}

/** The config as an object, or why it cannot be used. Needs an `id` (the brand id) and a `name`. */
export function parseConfig(json: string): { config: Record<string, unknown> } | { error: string } {
  if (!json.trim()) return { error: 'Paste your brand config.' };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { error: 'The brand config is not valid JSON.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'The brand config must be a JSON object.' };
  }
  const config = value as Record<string, unknown>;
  if (typeof config.id !== 'string' || !BRAND_ID.test(config.id)) {
    return { error: 'The config needs an "id": 2 to 32 lowercase letters, digits or hyphens. It is your brand id.' };
  }
  if (typeof config.name !== 'string' || !config.name.trim()) {
    return { error: 'The config needs a "name": the name your customers see.' };
  }
  return { config };
}

export type Problems = Partial<Record<keyof WhiteLabelRequest, string>>;

/** Every reason the request cannot be sent yet, by field. Empty when it is ready. */
export function validateRequest(req: WhiteLabelRequest): Problems {
  const problems: Problems = {};
  if (!EMAIL.test(req.contactEmail.trim())) problems.contactEmail = 'Enter your email address, so we can reply.';
  const production = parseDomains(req.productionDomains);
  if (production.length === 0) problems.productionDomains = 'Enter at least one domain that will host the pages.';
  const bad = (list: string[]) => list.find((d) => !HOSTNAME.test(d));
  const badProduction = bad(production);
  if (badProduction) problems.productionDomains = `"${badProduction}" is not a domain name.`;
  const badTest = bad(parseDomains(req.testDomains));
  if (badTest) problems.testDomains = `"${badTest}" is not a domain name.`;
  const parsed = parseConfig(req.configJson);
  if ('error' in parsed) problems.configJson = parsed.error;
  return problems;
}

/** The email to send us. Assumes validateRequest found nothing. */
export function buildEmail(req: WhiteLabelRequest): { to: string; subject: string; body: string } {
  const parsed = parseConfig(req.configJson);
  const config = 'config' in parsed ? parsed.config : {};
  const lines = [
    'White-label request',
    '',
    `Contact: ${[req.contactName.trim(), `<${req.contactEmail.trim()}>`].filter(Boolean).join(' ')}`,
    `Brand id: ${String(config.id ?? '')}`,
    `Display name: ${String(config.name ?? '')}`,
    `Production domains: ${parseDomains(req.productionDomains).join(', ')}`,
    `Test domains: ${parseDomains(req.testDomains).join(', ') || '(none)'}`,
    '',
    'Logo and font files: attached to this email.',
    ...(req.notes.trim() ? ['', 'Notes:', req.notes.trim()] : []),
    '',
    'Brand config:',
    JSON.stringify(config, null, 2),
  ];
  return {
    to: WHITE_LABEL_INBOX,
    subject: `White-label request: ${String(config.id ?? '')} (${String(config.name ?? '')})`,
    body: lines.join('\n'),
  };
}

export function mailtoHref(email: { to: string; subject: string; body: string }): string {
  return `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}

/** A file the partner attached, read in the browser. */
export interface RequestAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
  /** Decoded size, for the limits below. */
  size: number;
}

/** The same limits emailservice enforces, checked first so the partner hears it before uploading. */
export const ATTACHMENT_LIMITS = { count: 6, bytes: 1_000_000, extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico', 'woff2'] };

/** Why these files cannot be sent, or null when they can. */
export function attachmentProblem(files: RequestAttachment[]): string | null {
  if (files.length > ATTACHMENT_LIMITS.count) return `Attach at most ${ATTACHMENT_LIMITS.count} files.`;
  const wrongType = files.find((f) => !ATTACHMENT_LIMITS.extensions.includes(f.filename.split('.').pop()?.toLowerCase() ?? ''));
  if (wrongType) return `${wrongType.filename} is not a PNG, JPEG, WebP, SVG, ICO or WOFF2 file.`;
  const tooBig = files.find((f) => f.size > ATTACHMENT_LIMITS.bytes);
  if (tooBig) return `${tooBig.filename} is larger than 1 MB.`;
  return null;
}

/** The body for POST /api/white-label-request. There is no recipient: emailservice decides that. */
export function buildPayload(req: WhiteLabelRequest, attachments: RequestAttachment[]) {
  return {
    contactName: req.contactName.trim() || null,
    contactEmail: req.contactEmail.trim(),
    productionDomains: parseDomains(req.productionDomains),
    testDomains: parseDomains(req.testDomains),
    config: req.configJson,
    notes: req.notes.trim() || null,
    attachments: attachments.map(({ filename, contentType, contentBase64 }) => ({ filename, contentType, contentBase64 })),
  };
}
