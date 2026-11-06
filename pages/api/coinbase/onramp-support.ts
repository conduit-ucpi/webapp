import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { cdpRequest, getCdpCredentials } from '@/lib/server/coinbaseCdp';

/**
 * Whether Coinbase can take money from a buyer in this country, so the payment screen can say so
 * before sending them there to be turned away. Public: a published list, asked before signing.
 *
 * ⚠️ BEING LISTED IS NOT ENOUGH. Mexico, Colombia, Argentina, Chile and Peru are in Coinbase's list
 *    with only CRYPTO_ACCOUNT, an existing Coinbase balance: no card and no bank, so a buyer with no
 *    crypto cannot buy there (checked 2026-11-06). Venezuela is not listed at all.
 */

const CACHE_MS = 60 * 60 * 1000;
let cache: { countries: Map<string, string[]>; at: number } | null = null;

interface BuyConfig {
  countries?: { id?: string; payment_methods?: { id?: string }[] }[];
}

export function _resetOnrampSupportCacheForTesting() {
  cache = null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  const { country } = req.query;
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({ error: 'A country code is required' });
  }

  if (!cache || Date.now() - cache.at >= CACHE_MS) {
    const credentials = getCdpCredentials();
    if (!credentials) return res.status(503).json({ error: 'Coinbase Onramp is not configured on this server' });
    try {
      const response = await cdpRequest({ credentials, method: 'GET', path: '/onramp/v1/buy/config' });
      if (!response.ok) {
        console.error('Coinbase buy-config request failed:', { status: response.status });
        return res.status(502).json({ error: 'Could not read the country list from Coinbase' });
      }
      const config = JSON.parse(await response.text()) as BuyConfig;
      const countries = new Map(
        (config.countries ?? []).map((entry) => [
          entry.id ?? '',
          (entry.payment_methods ?? []).map((method) => method.id ?? ''),
        ])
      );
      // An empty list would read as "Coinbase serves nobody".
      if (countries.size === 0) return res.status(502).json({ error: 'Coinbase returned no countries' });
      cache = { countries, at: Date.now() };
    } catch (error) {
      console.error('Coinbase buy-config error:', error);
      return res.status(502).json({ error: 'Could not read the country list from Coinbase' });
    }
  }

  const methods = cache.countries.get(country) ?? [];
  return res.status(200).json({ country, supported: methods.some((method) => method !== 'CRYPTO_ACCOUNT') });
}
