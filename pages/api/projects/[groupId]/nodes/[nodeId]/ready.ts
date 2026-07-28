import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { fanoutServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * PUT /api/projects/[groupId]/nodes/[nodeId]/ready — the verifier's sign-off
 * that this contract's terms are ready to go on-chain (body: {ready}).
 * contractfanoutservice enforces that only that node's verifier may call it,
 * and refuses to deploy any chain containing an unapproved contract.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);
    const { groupId, nodeId } = req.query;
    if (typeof groupId !== 'string' || typeof nodeId !== 'string') {
      return res.status(400).json({ error: 'groupId and nodeId are required' });
    }

    const response = await fetch(
      `${fanoutServiceUrl()}/api/fanouts/${encodeURIComponent(groupId)}/nodes/${encodeURIComponent(nodeId)}/ready`,
      {
        method: 'PUT',
        headers: serviceHeaders(req, authToken),
        body: JSON.stringify({ ready: req.body?.ready !== false }),
      }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('projects mark-ready API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
