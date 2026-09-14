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
  // Deliberately a different failure: the key is set but signing is impossible,
  // which is a deployment mistake rather than a feature being off.
  if (!secretKey) {
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
    const escrowAddress: string | undefined = contract?.contractAddress;
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

    const environment = process.env.MOONPAY_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

    // baseCurrencyCode is deliberately absent: MoonPay geo-detect the payer's
    // local currency, which beats guessing from a browser locale. A Venezuelan
    // customer on an en-US profile is exactly where locale detection fails, and
    // that is the market this exists for.
    const params = new URLSearchParams({
      apiKey: publishableKey,
      currencyCode: CURRENCY_CODE,
      walletAddress: escrowAddress,
      quoteCurrencyAmount,
      // Echoed back on the webhook, so a completed purchase can be tied to the
      // escrow it was meant to fund.
      externalTransactionId: contractId,
    });

    // Signed over the query string exactly as it will be sent, including the
    // leading '?', per MoonPay's URL-signing rules. Any difference in order or
    // encoding between what is signed and what is sent fails verification.
    const query = `?${params.toString()}`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(query)
      .digest('base64');

    const host = WIDGET_HOST[environment];
    const url = `${host}${query}&signature=${encodeURIComponent(signature)}`;

    return res.status(200).json({
      url,
      // Returned so the client can render the figure it is about to send the
      // payer to pay, without recomputing it from a different source.
      quoteCurrencyAmount,
      escrowAddress,
      environment,
    });
  } catch (error) {
    console.error('MoonPay sign: unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
