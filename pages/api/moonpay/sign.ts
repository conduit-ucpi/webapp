import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { requireAuth } from '@/utils/api-auth';

/**
 * Signs a MoonPay widget URL that funds one escrow.
 *
 * MoonPay refuse to load the widget when `walletAddress` is present unless the
 * URL carries a matching `signature`, which is an HMAC over the query string
 * made with our secret key. The secret stays here; only the digest reaches the
 * browser, and it covers a SPECIFIC parameter set — which is the whole reason
 * a visible publishable key is not a problem. Change the address and the
 * signature stops verifying.
 *
 * ⚠️ THIS MUST NOT BECOME A SIGNING ORACLE. The destination and the amount are
 *    read from the contract, never from the request body. An endpoint that
 *    signs a caller-supplied `walletAddress` would issue our valid signatures
 *    for anybody's payout — giving away the secret's authority without ever
 *    leaking the secret. The body carries a contract id and nothing else that
 *    reaches the signature.
 *
 * Runs on the box only, like the rest of pages/api. The static export has no
 * API routes, which is also why the client must not try to sign anything
 * itself.
 */

/**
 * The MoonPay currency code for the token we settle in.
 *
 * MoonPay name assets per chain, so this has to say Base — a bare `usdc` can
 * deliver on the wrong chain, and those funds are gone. Configurable because it
 * has NOT been confirmed against their Currencies API for our markets; see
 * MOONPAY_INTEGRATION_PLAN.md.
 */
const CURRENCY_CODE = process.env.MOONPAY_CURRENCY_CODE || 'usdc_base';

const WIDGET_HOST: Record<string, string> = {
  sandbox: 'https://buy-sandbox.moonpay.com',
  production: 'https://buy.moonpay.com',
};

/** Micro-units per token. Contract amounts are stored in microUSDC. */
const MICRO = 1_000_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = process.env.MOONPAY_API_KEY;
  const secretKey = process.env.MOONPAY_SECRET_KEY;

  // The same variable the client flags on, so the button and the endpoint can
  // never disagree about whether MoonPay is switched on.
  if (!publishableKey) {
    return res.status(503).json({ error: 'MoonPay is not configured' });
  }
  const environment = process.env.MOONPAY_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

  // Without the secret we cannot sign, and MoonPay reject an unsigned URL that
  // carries a wallet address: HTTP 400, "Missing signature", widget does not
  // load. So there is no way to keep the real flow and skip signing.
  //
  // In sandbox we fall back to a PREVIEW: no walletAddress, no signature. The
  // widget opens and the UI can be checked, but MoonPay will ask the buyer for
  // their own address and the escrow is NOT funded. That is a demo, not a
  // payment route, and the response says so.
  //
  // Never in production. Degrading silently there would take real money from a
  // buyer, deliver it to their own wallet, and leave the escrow unfunded — the
  // payment would appear to succeed and the seller would never be paid.
  if (!secretKey && environment === 'production') {
    return res.status(500).json({ error: 'MoonPay signing key is not configured' });
  }

  let authToken: string;
  try {
    authToken = requireAuth(req);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { contractId } = req.body ?? {};
  if (!contractId || typeof contractId !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  try {
    // The caller's own token goes upstream, so contractservice applies its
    // normal access rules: someone who cannot read this contract cannot get a
    // signed URL pointing at its escrow either.
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
      return res
        .status(upstream.status === 404 ? 404 : 502)
        .json({ error: upstream.status === 404 ? 'Contract not found' : 'Could not load contract' });
    }

    const contract = await upstream.json();

    // The escrow has to be deployed before anyone can send to it. The client
    // resolves/creates it first; if it has not, say so plainly rather than
    // signing a URL pointing at nothing.
    //
    // The field is `chainAddress` — that is what contractservice's
    // PendingContract holds and what ContractPayPage reads. `contractAddress`
    // is the CHAINSERVICE spelling of the same thing and appears on its
    // responses, so it is accepted as a fallback rather than left as a trap for
    // whoever next passes a chainservice payload through here.
    const escrowAddress: string | undefined =
      contract?.chainAddress || contract?.contractAddress;
    if (!escrowAddress) {
      return res.status(409).json({ error: 'Escrow contract is not deployed yet' });
    }

    const microAmount = Number(contract?.amount);
    if (!Number.isFinite(microAmount) || microAmount <= 0) {
      return res.status(422).json({ error: 'Contract has no payable amount' });
    }

    // The crypto side is authoritative and the fiat is derived, because
    // EscrowContract.deposit reverts with TransferAmountMismatch unless exactly
    // AMOUNT arrives. Fixing the fiat instead would underfund escrows routinely.
    // Rounded up to the cent so rounding can never deliver a hair under.
    const quoteCurrencyAmount = (Math.ceil((microAmount / MICRO) * 100) / 100).toString();

    const preview = !secretKey;

    // baseCurrencyCode is deliberately absent: MoonPay geo-detect the payer's
    // local currency, which beats guessing from a browser locale. A Venezuelan
    // customer on an en-US profile is exactly where locale detection fails, and
    // that is the market this exists for.
    const params = new URLSearchParams({
      apiKey: publishableKey,
      currencyCode: CURRENCY_CODE,
      quoteCurrencyAmount,
      // Echoed back on the webhook, so a completed purchase can be tied to the
      // escrow it was meant to fund.
      externalTransactionId: contractId,
      // The destination is what makes a signature mandatory, so the preview
      // cannot carry it. Dropping it is what lets the widget open unsigned.
      ...(preview ? {} : { walletAddress: escrowAddress }),
    });

    const query = `?${params.toString()}`;
    const host = WIDGET_HOST[environment];

    // Signed over the query string exactly as it will be sent, including the
    // leading '?', per MoonPay's URL-signing rules. Any difference in order or
    // encoding between what is signed and what is sent fails verification.
    //
    // URLSearchParams percent-encodes values, which satisfies MoonPay's rule
    // that parameter VALUES are encoded before signing. Its encoding is not
    // identical to encodeURIComponent in every case; today every value here is
    // alphanumeric (address, decimal, currency code, object id) so the two
    // agree. Adding an email or a free-text description would need checking.
    const url = preview
      ? `${host}${query}`
      : `${host}${query}&signature=${encodeURIComponent(
          crypto.createHmac('sha256', secretKey as string).update(query).digest('base64')
        )}`;

    return res.status(200).json({
      url,
      // Returned so the client can render the figure it is about to send the
      // payer to pay, without recomputing it from a different source.
      quoteCurrencyAmount,
      // Absent in preview, because nothing is being sent there.
      escrowAddress: preview ? null : escrowAddress,
      environment,
      /**
       * True when the widget will NOT fund the escrow. Set MOONPAY_SECRET_KEY
       * to turn the real flow on; see MOONPAY_INTEGRATION_PLAN.md.
       */
      preview,
    });
  } catch (error) {
    console.error('MoonPay sign: unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
