import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { draftToCreateRequest, fanoutServiceUrl, serviceHeaders } from '@/utils/projectsServer';

/**
 * GET  /api/projects — root node of every project tree the caller is a party to.
 * POST /api/projects — create a project tree. The body is a ProjectDraft
 *   (recipient shares as $ amounts or %); the $→bps conversion is done here,
 *   server-side, then forwarded to contractfanoutservice /api/fanouts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    let body: string | undefined;
    if (req.method === 'POST') {
      try {
        body = JSON.stringify(draftToCreateRequest(req.body));
      } catch (conversionError) {
        return res.status(400).json({
          error: conversionError instanceof Error ? conversionError.message : 'Invalid project draft',
        });
      }
    }

    const response = await fetch(`${fanoutServiceUrl()}/api/fanouts`, {
      method: req.method,
      headers: serviceHeaders(req, authToken),
      body,
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('projects index API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
