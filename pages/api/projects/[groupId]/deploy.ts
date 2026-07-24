import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { fanoutServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * POST /api/projects/[groupId]/deploy — deploy the whole tree on-chain,
 * bottom-up, via contractfanoutservice (body: DeployProjectRequest). The
 * relayer signs and pays gas; node addresses are recorded automatically.
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
      `${fanoutServiceUrl()}/api/fanouts/${encodeURIComponent(groupId)}/deploy`,
      {
        method: 'POST',
        headers: serviceHeaders(req, authToken),
        body: JSON.stringify(req.body),
      }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('projects deploy API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
