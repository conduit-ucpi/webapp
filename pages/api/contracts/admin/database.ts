import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Forward the request to the contract service
    const contractServiceUrl = process.env.CONTRACT_SERVICE_URL || 'http://localhost:8979';
    
    const response = await fetch(`${contractServiceUrl}/api/contracts/admin/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for authentication
        'Cookie': req.headers.cookie || '',
      },
      body: JSON.stringify(req.body),
    });

    // ⚠️ A REFUSAL HAS NO BODY. contractservice answers someone who is not an admin with a bare
    //    403, and parsing that as JSON threw, so every refused stranger was logged here as a
    //    crash and told 500. The status is passed on as it came, with the body when there is one.
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json(data ?? { message: 'Request refused' });
    }
    if (data === null) {
      console.error('Admin database: contractservice answered', response.status, 'with no readable body');
      return res.status(502).json({ message: 'The contract service gave no readable answer' });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error proxying admin database request:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
