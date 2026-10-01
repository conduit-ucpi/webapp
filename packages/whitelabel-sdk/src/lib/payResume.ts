/**
 * A /pay payment, carried in its own URL so the page can pick it up again.
 *
 * On a phone, Coinbase (adding funds, or paying by card) takes over the whole tab and sends the
 * buyer back by URL; a refresh or the Back button does the same. The page's memory is gone each
 * time, so the payment rides in the URL instead: `/pay?resume=<this>`.
 *
 * ⚠️ THE EXTERNAL ID IS THE PART THAT MATTERS. It is one of the terms the escrow address derives
 *    from, and prepare generates a fresh one when none is given — so resuming without it would
 *    quote a DIFFERENT escrow, while a card payment may already be sitting in the first. With
 *    it, prepare returns the same address and finds the same reservation.
 *
 * Nothing here is secret: these terms are what the escrow address is derived from, and anyone
 * holding the address can already see what it holds. Validated on the way in, because a URL is
 * something anyone can edit — a malformed one is ignored rather than half-applied.
 */

export interface PayResume {
  /** As the buyer entered it: an email or a wallet. prepare resolves an email the same way twice. */
  seller: string;
  /** In whole tokens, as typed ("12.50"). */
  amount: string;
  expiryTimestamp: number;
  description: string;
  tokenSymbol: string;
  externalId: string;
  /**
   * Who may dispute, when it is not whoever signs in to pay: a payment REQUEST names its buyer up
   * front (ap2service's prepare, or contractservice's request email), and that wallet is one of
   * the terms. Absent on a buyer's own /pay payment, where the payer is the nominal buyer.
   */
  nominalBuyer?: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodePayResume(resume: PayResume): string {
  return toBase64Url(JSON.stringify(resume));
}

/** The payment in a `resume` parameter, or null when it is missing or not one of ours. */
export function decodePayResume(encoded: unknown): PayResume | null {
  if (typeof encoded !== 'string' || !encoded) return null;
  try {
    const value = JSON.parse(fromBase64Url(encoded));
    const ok =
      typeof value?.seller === 'string' && value.seller.trim() !== '' &&
      typeof value.amount === 'string' && /^\d+(\.\d+)?$/.test(value.amount) &&
      Number.isInteger(value.expiryTimestamp) && value.expiryTimestamp >= 0 &&
      typeof value.description === 'string' &&
      typeof value.tokenSymbol === 'string' && value.tokenSymbol !== '' &&
      typeof value.externalId === 'string' && value.externalId !== '' &&
      (value.nominalBuyer === undefined || (typeof value.nominalBuyer === 'string' && value.nominalBuyer.trim() !== ''));
    if (!ok) return null;
    const { seller, amount, expiryTimestamp, description, tokenSymbol, externalId, nominalBuyer } = value;
    return { seller, amount, expiryTimestamp, description, tokenSymbol, externalId, ...(nominalBuyer ? { nominalBuyer } : {}) };
  } catch {
    return null;
  }
}

/**
 * A checkout's own URL with the payment added: every merchant parameter (return address, order
 * id) kept, and any earlier `resume` replaced. /contract-create comes back here, not to /pay.
 */
export function withPayResume(asPath: string, resume: string | null): string {
  const url = new URL(asPath, 'http://checkout.local');
  if (resume) url.searchParams.set('resume', resume);
  return `${url.pathname}${url.search}`;
}
