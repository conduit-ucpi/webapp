import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { cdpRequest, getCdpCredentials } from '@/lib/server/coinbaseCdp';

/**
 * Coinbase's smallest card purchase in a currency, so the payment screen can say so before a buyer
 * is sent there to be refused. Public, like the fee quote: a published limit, asked before signing.
 *
 * ⚠️ ASKED FOR ONE COUNTRY. The API takes a country and we do not reliably know the buyer's. The
 *    limits were the same for US, GB and NL when checked on 2026-11-06 (2 USD, EUR and GBP; 38 MXN).
 *    This says what the minimum is, not whether Coinbase serves this buyer at all.
 */

const CACHE_MS = 60 * 60 * 1000;
const cache = new Map<string, { minimum: number; at: number }>();

interface BuyOptions {
  payment_currencies?: { id?: string; limits?: { id?: string; min?: string }[] }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  const { currency } = req.query;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'A currency code is required' });
  }

  const cached = cache.get(currency);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return res.status(200).json({ currency, minimum: cached.minimum });
  }

  const credentials = getCdpCredentials();
  if (!credentials) return res.status(503).json({ error: 'Coinbase Onramp is not configured on this server' });

  try {
    const response = await cdpRequest({
      credentials,
      method: 'GET',
      path: '/onramp/v1/buy/options',
      query: { country: 'US', networks: 'base' },
    });
    if (!response.ok) {
      console.error('Coinbase buy-options request failed:', { status: response.status });
      return res.status(502).json({ error: 'Could not read the minimum from Coinbase' });
    }
    const options = JSON.parse(await response.text()) as BuyOptions;
    const limits = options.payment_currencies?.find((entry) => entry.id === currency)?.limits;
    const minimum = Number(limits?.find((limit) => limit.id === 'CARD')?.min);
    if (!(minimum > 0)) return res.status(404).json({ error: 'Coinbase has no card minimum for this currency' });

    cache.set(currency, { minimum, at: Date.now() });
    return res.status(200).json({ currency, minimum });
  } catch (error) {
    console.error('Coinbase buy-options error:', error);
    return res.status(502).json({ error: 'Could not read the minimum from Coinbase' });
  }
}
