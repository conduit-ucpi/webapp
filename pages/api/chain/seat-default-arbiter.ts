import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

/**
 * Fire the permissionless `seatDefaultArbiter()` from the platform relayer
 * (MARKETPLACE_OPENSPEC §15.6c).
 *
 * This is the one dispute action the platform sends itself, and it is safe to: the call is
 * permissionless on-chain and seats the DEFAULT_ARBITER Safe, never the caller, so the platform
 * gains no dispute power by making it. Every other action on these screens — the settlement
 * vote, nominate, evict — is signed by the user's own wallet and never comes near this route.
 *
 * A revert here is an ordinary race, not an error: a late matching nomination still wins right
 * up until this executes. Re-read the arbiter state and re-render.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/seat-default-arbiter`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Seat default arbiter API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
