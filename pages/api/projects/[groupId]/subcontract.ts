import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { fanoutServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * POST /api/projects/[groupId]/subcontract — attach a new loose subcontract
 * tree under a recipient slice of an existing node (body: SubcontractRequest).
 * Only the slice's recipient or the node's seller may do this; enforced by
 * contractfanoutservice.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);
    const { groupId } = req.query;
    if (typeof groupId !== 'string') {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const response = await fetch(
      `${fanoutServiceUrl()}/api/fanouts/${encodeURIComponent(groupId)}/subcontract`,
      {
        method: 'POST',
        headers: serviceHeaders(req, authToken),
        body: JSON.stringify(req.body),
      }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('projects subcontract API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
