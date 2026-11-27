import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

/** Who the /sd-reporting page, and this route behind it, are for. */
export const SD_REPORTING_USER_TYPES = ['sd-reporting', 'admin'];

/**
 * The /sd-reporting page's contract list: the admin Local Database list with every email
 * redacted by contractservice, for sd-reporting and admin users.
 *
 * Checked here, as the admin routes are, and again by contractservice's /reporting/database
 * (which also does the redaction) and chainservice (for the statuses). It never reads the
 * unredacted /admin/database, even for an admin.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    const identityResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': req.headers.cookie || ''
      }
    });

    if (!identityResponse.ok) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const userData = await identityResponse.json();
    if (!SD_REPORTING_USER_TYPES.includes(userData.userType)) {
      return res.status(403).json({ error: 'sd-reporting or admin access required' });
    }

    const contractServiceUrl = process.env.CONTRACT_SERVICE_URL || 'http://localhost:8979';
    const response = await fetch(`${contractServiceUrl}/api/contracts/reporting/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    console.error('sd-reporting contracts request failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
