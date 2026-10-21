import { NextApiRequest } from 'next';
import { requireAuth } from '@/utils/api-auth';

/**
 * The sanctions check before a fee sweep: everyone connected to one escrow, screened now.
 *
 * Each service does only its own job, and this joins them up:
 *   chainservice     the parties in the escrow's terms as the chain has them now, and every
 *                    address that ever sent its token to it (GET /api/admin/escrows/{a}/parties)
 *   contractservice  the emails on the escrow's record and userservice's proven email for each
 *                    wallet (POST /api/contracts/admin/escrow-parties)
 *   sanctionservice  a 0-100 score for every wallet, email and domain (POST /api/sanctions/screen)
 *
 * WHO MAY RUN IT: chainservice and contractservice each check the admin's session for themselves,
 * and chainservice's answer is required before anything is screened. sanctionservice is reached
 * on the services' network with the subjects alone: it never sees the session.
 *
 * NEVER CLEAN WHEN INCOMPLETE: a missing record, a failed lookup or a partial scan leaves somebody
 * unchecked, so `clean` needs no hits AND no warnings. sanctionservice not answering every subject
 * is not a check at all, and fails the request.
 */

export interface ScreenedSubject {
  roles: string;
  type: 'WALLET' | 'EMAIL' | 'DOMAIN';
  value: string;
  risk: number;
}

export interface SweepScreenResult {
  contractAddress: string;
  clean: boolean;
  complete: boolean;
  hits: number;
  subjects: ScreenedSubject[];
  warnings: string[];
  fundersFromBlock?: string;
  fundersToBlock?: string;
}

interface EscrowParties {
  createdAt: number | null;
  arbiterReadable: boolean;
  parties: { role: string; address: string }[];
  funders: string[];
  fundersComplete: boolean;
  fundersFromBlock: string;
  fundersToBlock: string;
  fundedSinceSource: string;
}

interface RecordParties {
  recordFound: boolean;
  createdAt: number | null;
  recordEmails: { role: string; email: string }[];
  walletEmails: { wallet: string; lookup: string; email: string | null; detail: string | null }[];
}

/** sanctionservice refuses a request carrying more subjects than this. */
const MAX_SUBJECTS = 100;

/** A refusal or failure to hand back to the browser as-is. */
export class ScreenFailure extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callAsAdmin<T>(req: NextApiRequest, baseUrl: string | undefined, path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<{ status: number; body: T | null }> {
  if (!baseUrl) throw new ScreenFailure(500, 'Service not configured');
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${requireAuth(req)}`,
      Cookie: req.headers.cookie || ''
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const text = await response.text();
  let body: T | null = null;
  try {
    body = text ? (JSON.parse(text) as T) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function scores(subjects: { type: string; value: string }[], reference: string): Promise<number[]> {
  const baseUrl = process.env.SANCTION_SERVICE_URL;
  if (!baseUrl) throw new ScreenFailure(500, 'SANCTION_SERVICE_URL is not configured');
  const risks: number[] = [];
  for (let i = 0; i < subjects.length; i += MAX_SUBJECTS) {
    const batch = subjects.slice(i, i + MAX_SUBJECTS);
    let results: { risk?: number }[] | undefined;
    try {
      const response = await fetch(`${baseUrl}/api/sanctions/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: batch, reference })
      });
      results = response.ok ? (await response.json())?.results : undefined;
    } catch (error) {
      console.error(`SANCTIONS SCREENING UNAVAILABLE for ${reference}:`, error);
    }
    if (!results || results.length !== batch.length || results.some((r) => typeof r.risk !== 'number')) {
      throw new ScreenFailure(503, 'Sanctions screening is unavailable: sanctionservice did not score every subject');
    }
    risks.push(...results.map((r) => r.risk as number));
  }
  return risks;
}

export async function screenBeforeSweep(req: NextApiRequest, contractAddress: string, targets: string[]): Promise<SweepScreenResult> {
  requireAuth(req); // before any call, so "no session" is a 401 and not a warning about contractservice
  const chainUrl = process.env.CHAIN_SERVICE_URL;
  const contractUrl = process.env.CONTRACT_SERVICE_URL;
  const warnings: string[] = [];

  const subjects = new Map<string, { type: ScreenedSubject['type']; value: string; roles: Set<string> }>();
  const add = (type: ScreenedSubject['type'], value: string | null | undefined, role: string) => {
    const v = value?.trim();
    if (!v) return;
    const key = `${type}:${v.toLowerCase()}`;
    if (!subjects.has(key)) subjects.set(key, { type, value: v, roles: new Set() });
    subjects.get(key)!.roles.add(role);
  };

  // 1. The record: its emails, and the quote time that bounds the funder scan.
  let record: RecordParties | null = null;
  const first = await callAsAdmin<RecordParties>(req, contractUrl, '/api/contracts/admin/escrow-parties', {
    method: 'POST', body: { chainAddress: contractAddress, wallets: [] }
  }).catch((error) => {
    warnings.push(`contractservice did not answer, so no emails were checked: ${error instanceof Error ? error.message : error}`);
    return null;
  });
  if (first && (first.status === 401 || first.status === 403)) throw new ScreenFailure(first.status, 'Only an admin user may run this check');
  if (first && first.status === 200 && first.body) record = first.body;
  else if (first) warnings.push(`contractservice answered ${first.status}, so no emails were checked`);
  if (record && !record.recordFound) warnings.push('contractservice has no record of this escrow, so there are no recorded emails');

  // 2. The chain: the terms as they are now, and every funder. Its admin check gates the rest.
  const since = record?.createdAt ? `?fundedSince=${record.createdAt}` : '';
  const chain = await callAsAdmin<EscrowParties & { error?: string }>(req, chainUrl, `/api/admin/escrows/${contractAddress}/parties${since}`, { method: 'GET' });
  if (chain.status !== 200 || !chain.body) {
    throw new ScreenFailure(chain.status === 200 ? 502 : chain.status, chain.body?.error ?? `chainservice answered ${chain.status}`);
  }
  const onChain = chain.body;
  if (!onChain.arbiterReadable) warnings.push('The arbiter (ARBITER()) could not be read from the escrow');
  if (!onChain.fundersComplete) warnings.push(`Part of the transfer scan (blocks ${onChain.fundersFromBlock}..${onChain.fundersToBlock}) failed, so a funder may be unseen`);
  if (onChain.fundedSinceSource !== 'caller') warnings.push(`With no quote time, the funder scan started from ${onChain.fundedSinceSource === 'onchain-createdAt' ? '3 days before the escrow was deployed' : 'the default lookback'}; earlier transfers were not seen`);

  onChain.parties.forEach((p) => add('WALLET', p.address, p.role));
  onChain.funders.forEach((f) => add('WALLET', f, 'funder'));
  targets.forEach((t) => add('WALLET', t, 'sweep target'));

  // 3. The emails: the record's, and the proven email of every wallet.
  record?.recordEmails.forEach((e) => add('EMAIL', e.email, `email of ${e.role}`));
  if (record) {
    const wallets = Array.from(subjects.values()).filter((s) => s.type === 'WALLET').map((s) => s.value);
    const second = await callAsAdmin<RecordParties>(req, contractUrl, '/api/contracts/admin/escrow-parties', {
      method: 'POST', body: { chainAddress: contractAddress, wallets }
    }).catch(() => null);
    if (!second || second.status !== 200 || !second.body) {
      warnings.push(`contractservice did not answer for the wallets' emails${second ? ` (${second.status})` : ''}`);
    } else {
      second.body.walletEmails.forEach((w) => {
        const owner = Array.from(subjects.get(`WALLET:${w.wallet.toLowerCase()}`)?.roles ?? ['wallet']).join(', ');
        if (w.lookup === 'FOUND') add('EMAIL', w.email, `email of ${owner} ${w.wallet}`);
        else if (w.lookup !== 'NONE') warnings.push(`The email of ${owner} ${w.wallet} could not be looked up (${w.lookup}${w.detail ? `: ${w.detail}` : ''})`);
      });
    }
  }

  // 4. The domain of every email.
  Array.from(subjects.values()).filter((s) => s.type === 'EMAIL').forEach((e) => {
    const host = e.value.slice(e.value.lastIndexOf('@') + 1).trim().toLowerCase();
    if (e.value.includes('@') && host) add('DOMAIN', host, `domain of ${e.value}`);
  });

  // 5. Score them all.
  const list = Array.from(subjects.values());
  const risks = await scores(list.map((s) => ({ type: s.type, value: s.value })), contractAddress);
  const results: ScreenedSubject[] = list.map((s, i) => ({ roles: Array.from(s.roles).join(', '), type: s.type, value: s.value, risk: risks[i] }));
  const hits = results.filter((r) => r.risk > 0);
  // Roles can quote an email, so only wallets and domains are named; sanctionservice's own log
  // holds the keyed hash of a matched email.
  hits.forEach((h) => console.error(`SANCTIONED ${h.type}: ${h.type === 'EMAIL' ? '[email]' : h.value} of contract ${contractAddress} has sanctions risk ${h.risk}% (fee sweep check)`));

  return {
    contractAddress,
    clean: hits.length === 0 && warnings.length === 0,
    complete: warnings.length === 0,
    hits: hits.length,
    subjects: [...hits, ...results.filter((r) => r.risk === 0)],
    warnings,
    fundersFromBlock: onChain.fundersFromBlock,
    fundersToBlock: onChain.fundersToBlock
  };
}
