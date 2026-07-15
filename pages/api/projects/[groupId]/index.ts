import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { buildTreeView, fanoutServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * GET /api/projects/[groupId]?viewer=0x...
 *
 * The detail-page payload: the tree's nodes from contractfanoutservice merged
 * server-side with live chain state (fanOutChainService batch-info), the
 * viewer's roles per node, the fee quote, and per-recipient payout previews.
 * The client renders this verbatim.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);
    const { groupId } = req.query;
    if (typeof groupId !== 'string') {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const treeResponse = await fetch(`${fanoutServiceUrl()}/api/fanouts/${encodeURIComponent(groupId)}`, {
      headers: serviceHeaders(req, authToken),
    });
    if (!treeResponse.ok) {
      const body = await treeResponse.json().catch(() => ({}));
      return res.status(treeResponse.status).json(body);
    }
    const tree = await treeResponse.json();

    const view = await buildTreeView(req, authToken, tree.groupId, tree.nodes);
    res.status(200).json(view);
  } catch (error) {
    console.error('projects detail API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
