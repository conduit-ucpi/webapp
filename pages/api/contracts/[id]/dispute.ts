import { NextApiRequest, NextApiResponse } from 'next';
import { SubmitDisputeEntryRequest } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method === 'POST') {
    return handleSubmitDisputeEntry(req, res, id);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSubmitDisputeEntry(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Extract the AUTH-TOKEN from cookies
    const cookies = req.headers.cookie || '';
    const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
    const authToken = authTokenMatch ? authTokenMatch[1] : null;

    console.log('Submit dispute entry request for contract:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('Dispute entry data:', req.body);

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request body
    const disputeEntry: SubmitDisputeEntryRequest = req.body;
    if (!disputeEntry.timestamp || !disputeEntry.userEmail || !disputeEntry.reason || disputeEntry.refundPercent === undefined) {
      return res.status(400).json({ error: 'Missing required fields: timestamp, userEmail, reason, refundPercent' });
    }

    if (disputeEntry.refundPercent < 0 || disputeEntry.refundPercent > 100) {
      return res.status(400).json({ error: 'refundPercent must be between 0 and 100' });
    }

    if (disputeEntry.reason.length > 160) {
      return res.status(400).json({ error: 'reason must be 160 characters or less' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
    };

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/dispute`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/dispute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(disputeEntry)
    });

    const responseData = await response.json();
    console.log('Contract Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Submit dispute entry API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}