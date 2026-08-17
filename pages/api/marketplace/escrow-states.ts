import { NextApiRequest, NextApiResponse } from 'next';

const RESULTSERVICE_URL = process.env.RESULTSERVICE_URL;

/**
 * The state and maturity of escrows the caller does not own (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THIS IS WHY IT GOES TO resultservice RATHER THAN contractservice. An LP's offers sit on
 *    escrows belonging to other people, so contractservice's records are not theirs to read —
 *    and contractservice never reads the chain, so it cannot answer from there either.
 *    resultservice is the public read view over the same records and exposes only public
 *    fields, which is exactly the scope an offers list needs.
 *
 * ⚠️ AND WHY IT IS A BATCH. A client describing twenty offers would otherwise make twenty
 *    round trips, or read twenty escrows off the chain itself — the fan-out this endpoint
 *    exists to collapse into one call.
 *
 * Returns a map keyed by lower-cased address so callers can look up whatever casing they hold.
 * An escrow with no record is simply absent: unknown, never "not funded".
 */
export interface EscrowStatesResponse {
  escrows: Record<string, { state: string; maturity: number }>;
}

interface ResultItem {
  chainAddress: string | null;
  state: string;
  maturity: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESULTSERVICE_URL) {
    console.error('escrow-states: RESULTSERVICE_URL is not configured');
    return res.status(500).json({ error: 'Result service is not configured' });
  }

  const addresses: unknown = req.body?.chainAddresses;
  if (!Array.isArray(addresses) || addresses.some((a) => typeof a !== 'string')) {
    return res.status(400).json({ error: 'chainAddresses must be an array of strings' });
  }

  const wanted = (addresses as string[]).filter((a) => a.trim().length > 0);
  // Not an error: a caller with no escrows to ask about gets an empty map rather than a 400,
  // so the client does not have to special-case its own empty list.
  if (wanted.length === 0) {
    return res.status(200).json({ escrows: {} } satisfies EscrowStatesResponse);
  }

  try {
    const response = await fetch(`${RESULTSERVICE_URL}/api/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainAddresses: wanted })
    });

    if (!response.ok) {
      console.warn('escrow-states: result service returned', response.status);
      return res.status(response.status).json({ error: 'Could not read escrow states' });
    }

    const body = await response.json();
    const escrows: EscrowStatesResponse['escrows'] = {};

    for (const item of (body.results ?? []) as ResultItem[]) {
      if (!item.chainAddress) continue;
      escrows[item.chainAddress.toLowerCase()] = {
        state: item.state,
        maturity: item.maturity
      };
    }

    return res.status(200).json({ escrows } satisfies EscrowStatesResponse);
  } catch (error) {
    console.error('escrow-states: failed to reach the result service', error);
    return res.status(502).json({ error: 'Could not reach the result service' });
  }
}
