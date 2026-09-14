import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { requireAuth } from '@/utils/api-auth';

/**
 * Prepares and signs a MoonPay widget URL that funds one escrow.
 *
 * Two phases, because only the SDK knows the exact URL it will transmit:
 *
 *   POST { contractId }        -> { params, environment }   the parameters
 *   POST { contractId, url }   -> { signature }             sign that URL
 *
 * The client builds the SDK with those parameters, calls
 * generateUrlForSigning(), sends the result back here, and applies the result
 * with updateSignature(). The round trip exists because the signature covers
 * the query string EXACTLY as sent: a URL assembled here and then re-serialised
 * by the SDK can differ in parameter order or encoding, and MoonPay then
 * rejects it with 400 on verify_widget_signature. Signing what the SDK will
 * actually send is the only reliable version, and it is the flow the SDK's own
 * generateUrlForSigning/updateSignature pair exists for.
 *
 * ⚠️ THIS MUST NOT BECOME A SIGNING ORACLE. Phase 2 accepts a URL from the
 *    browser, so it VERIFIES before it signs: destination, amount, currency and
 *    API key are recomputed from the contract and compared against what the URL
 *    claims, and a mismatch is refused. Signing a URL merely because someone
 *    asked would issue our valid signatures for anybody's payout — the secret
 *    would never leak, and would not need to.
 *
 * Runs on the box only, like the rest of pages/api.
 */

/**
 * The MoonPay currency code for the token we settle in.
 *
 * MoonPay name assets per chain, so this has to say Base — a bare `usdc`
 * delivers on Ethereum, and those funds are gone. Confirmed present and not
 * suspended on MoonPay's live currency list (`net=base`).
 */
const CURRENCY_CODE = process.env.MOONPAY_CURRENCY_CODE || 'usdc_base';

/** Hosts we will sign a URL for. Anything else is not our widget. */
const SIGNABLE_HOSTS = new Set(['buy-sandbox.moonpay.com', 'buy.moonpay.com']);

/**
 * Parameters that override the destination, and must never appear.
 *
 * MoonPay document that `walletAddresses` takes precedence over
 * `walletAddress`. A URL carrying our verified address AND a plural override
 * would pass a naive check and still pay someone else, so the plural forms are
 * refused outright rather than compared.
 */
const FORBIDDEN_PARAMS = ['walletAddresses', 'walletAddressTags', 'signature'];

/** Micro-units per token. Contract amounts are stored in microUSDC. */
const MICRO = 1_000_000;

interface EscrowTerms {
  escrowAddress: string;
  quoteCurrencyAmount: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = process.env.MOONPAY_API_KEY;
  const secretKey = process.env.MOONPAY_API_SECRET_KEY;

  // The same variable the client flags on, so the button and the endpoint can
  // never disagree about whether MoonPay is switched on.
  if (!publishableKey) {
    return res.status(503).json({ error: 'MoonPay is not configured' });
  }

  const environment = process.env.MOONPAY_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

  // Without the secret we cannot sign, and MoonPay reject an unsigned URL that
  // carries a wallet address. In sandbox we fall back to a PREVIEW: no
  // destination, no signature, widget opens, escrow NOT funded. Never in
  // production, where degrading silently would take real money from a buyer,
  // deliver it to their own wallet, and leave the seller unpaid.
  if (!secretKey && environment === 'production') {
    return res.status(500).json({ error: 'MoonPay signing key is not configured' });
  }
  const preview = !secretKey;

  let authToken: string;
  try {
    authToken = requireAuth(req);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { contractId, url } = req.body ?? {};
  if (!contractId || typeof contractId !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  try {
    const terms = await loadEscrowTerms(contractId, authToken, req);
    if ('error' in terms) return res.status(terms.status).json({ error: terms.error });

    // ---- Phase 1: the parameters the SDK should be built with ----
    if (url === undefined) {
      return res.status(200).json({
        params: {
          apiKey: publishableKey,
          currencyCode: CURRENCY_CODE,
          quoteCurrencyAmount: terms.quoteCurrencyAmount,
          // Echoed back on the webhook, so a completed purchase can be tied to
          // the escrow it was meant to fund.
          externalTransactionId: contractId,
          // baseCurrencyCode is deliberately absent: MoonPay geo-detect the
          // payer's local currency, which beats guessing from a browser locale.
          // A Venezuelan payer on an en-US profile is where that guess fails,
          // and that is the market this exists for.
          //
          // The destination is what makes a signature mandatory, so preview
          // cannot carry one.
          ...(preview ? {} : { walletAddress: terms.escrowAddress }),
        },
        environment,
        preview,
        quoteCurrencyAmount: terms.quoteCurrencyAmount,
        escrowAddress: preview ? null : terms.escrowAddress,
      });
    }

    // ---- Phase 2: verify the SDK's URL, then sign it ----
    if (typeof url !== 'string') {
      return res.status(400).json({ error: 'url must be a string' });
    }
    if (preview) {
      // Nothing to sign, and a signature would imply a destination that is
      // deliberately absent.
      return res.status(409).json({ error: 'Preview widgets are not signed' });
    }

    const problem = verifyUrl(url, publishableKey, terms);
    if (problem) {
      console.error('MoonPay sign: refused to sign a URL —', problem);
      return res.status(422).json({ error: `Refused to sign: ${problem}` });
    }

    // Signed over the query string exactly as the SDK will send it, including
    // the leading '?'. Taking it from the SDK's own URL rather than rebuilding
    // it is the entire point: any difference in order or encoding between what
    // is signed and what is transmitted fails verification.
    const query = url.slice(url.indexOf('?'));
    const signature = crypto
      .createHmac('sha256', secretKey as string)
      .update(query)
      .digest('base64');

    return res.status(200).json({ signature });
  } catch (error) {
    console.error('MoonPay sign: unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * The escrow's address and the exact amount owed, read from the contract.
 *
 * Both phases derive these independently of anything the caller sent, which is
 * what keeps phase 2 from being an oracle.
 */
async function loadEscrowTerms(
  contractId: string,
  authToken: string,
  req: NextApiRequest
): Promise<EscrowTerms | { error: string; status: number }> {
  // The caller's own token goes upstream, so contractservice applies its normal
  // access rules: someone who cannot read this contract cannot get a signed URL
  // pointing at its escrow either.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    Cookie: req.headers.cookie || '',
  };
  if (process.env.X_API_KEY) headers['X-API-Key'] = process.env.X_API_KEY;

  const upstream = await fetch(
    `${process.env.CONTRACT_SERVICE_URL}/api/contracts/${encodeURIComponent(contractId)}`,
    { method: 'GET', headers }
  );

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error('MoonPay sign: contract lookup failed', upstream.status, body);
    return upstream.status === 404
      ? { error: 'Contract not found', status: 404 }
      : { error: 'Could not load contract', status: 502 };
  }

  const contract = await upstream.json();

  // The field is `chainAddress` — that is what contractservice's PendingContract
  // holds and what ContractPayPage reads. `contractAddress` is the CHAINSERVICE
  // spelling of the same thing, accepted as a fallback.
  const escrowAddress: string | undefined = contract?.chainAddress || contract?.contractAddress;
  if (!escrowAddress) {
    return { error: 'Escrow contract is not deployed yet', status: 409 };
  }

  const microAmount = Number(contract?.amount);
  if (!Number.isFinite(microAmount) || microAmount <= 0) {
    return { error: 'Contract has no payable amount', status: 422 };
  }

  // The crypto side is authoritative and the fiat is derived, because
  // EscrowContract.deposit reverts with TransferAmountMismatch unless exactly
  // AMOUNT arrives. Rounded up to the cent so rounding never delivers a hair
  // under.
  const quoteCurrencyAmount = (Math.ceil((microAmount / MICRO) * 100) / 100).toString();

  return { escrowAddress, quoteCurrencyAmount };
}

/** Returns a reason to refuse, or null when the URL is ours to sign. */
function verifyUrl(url: string, publishableKey: string, terms: EscrowTerms): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'not a valid URL';
  }

  if (parsed.protocol !== 'https:') return 'not https';
  if (!SIGNABLE_HOSTS.has(parsed.hostname)) return `unexpected host ${parsed.hostname}`;

  const p = parsed.searchParams;

  for (const forbidden of FORBIDDEN_PARAMS) {
    if (p.has(forbidden)) return `carries ${forbidden}`;
  }

  if (p.get('apiKey') !== publishableKey) return 'apiKey is not ours';
  if (p.get('walletAddress') !== terms.escrowAddress) return 'walletAddress is not the escrow';
  if (p.get('currencyCode') !== CURRENCY_CODE) return 'currencyCode does not match';
  if (p.get('quoteCurrencyAmount') !== terms.quoteCurrencyAmount) {
    return 'quoteCurrencyAmount does not match the contract';
  }
  // A fiat amount alongside the crypto amount would be ignored by MoonPay, but
  // its presence means someone is driving the fiat side. Refuse rather than
  // rely on their precedence rules staying as documented.
  if (p.has('baseCurrencyAmount')) return 'carries baseCurrencyAmount';

  return null;
}
