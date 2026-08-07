import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

/**
 * The arbiter seat state of one escrow (MARKETPLACE_OPENSPEC §15.6c).
 *
 * The arbiter screens are driven entirely off this: show a control when its `can*` flag is true.
 * That is the whole rule — the UI never has to work out which implementation an escrow is a
 * clone of, because a LEGACY escrow simply comes back with every flag false.
 *
 * The flags are advisory, not authoritative. They mirror the escrow's own preconditions so the
 * UI need not re-derive them, but the chain decides and a race can always lose.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractAddress } = req.query;

  if (!contractAddress || typeof contractAddress !== 'string') {
    return res.status(400).json({ error: 'Contract address is required' });
  }

  try {
    const authToken = requireAuth(req);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || '',
      'Accept': 'application/json'
    };

    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    const response = await fetch(
      `${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contractAddress}/arbiter`,
      { headers }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Arbiter state API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
