import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { fanoutChainServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * POST /api/projects/chain/[action] — lifecycle operations on a project's
 * escrow, relayed through fanOutChainService (which sponsors gas). The body is
 * forwarded verbatim; role enforcement is on-chain via the wallet signature
 * inside the relayed transaction, not here.
 */
const ACTION_PATHS: Record<string, string> = {
  'mark-complete': '/api/chain/mark-complete',
  'verify-complete': '/api/chain/verify-complete',
  'raise-dispute': '/api/chain/raise-dispute',
  'approve-token': '/api/chain/approve-token',
  'fund': '/api/chain/fund-approved-contract',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;
  const path = typeof action === 'string' ? ACTION_PATHS[action] : undefined;
  if (!path) {
    return res.status(404).json({ error: `Unknown action: ${action}` });
  }

  try {
    const authToken = requireAuth(req);
    const response = await fetch(`${fanoutChainServiceUrl()}${path}`, {
      method: 'POST',
      headers: serviceHeaders(req, authToken),
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`projects chain ${action} API error:`, error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
