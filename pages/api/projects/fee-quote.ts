import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { fanoutChainServiceUrl, serviceHeaders } from '@/utils/projectsServer';
import { toBaseUnits } from '@/utils/projectMath';

/**
 * GET /api/projects/fee-quote?amount=<human amount>&decimals=6
 *
 * Platform fee preview for a top-level project. The formula lives in the
 * factory contract; fanOutChainService quotes it via eth_call — this route
 * only converts units. Returns { fee, netAmount } in base units.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);
    const amount = Number(req.query.amount);
    const decimals = req.query.decimals ? Number(req.query.decimals) : 6;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const baseUnits = toBaseUnits(amount, decimals);
    const response = await fetch(
      `${fanoutChainServiceUrl()}/api/chain/fee-quote?amount=${baseUnits}&isChild=false`,
      { headers: serviceHeaders(req, authToken) }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('projects fee-quote API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
