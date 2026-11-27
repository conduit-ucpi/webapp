import { NextApiRequest, NextApiResponse } from 'next';
import { isPathSegment } from '@/lib/server/serviceProxy';
import { SubmitDisputeEntryRequest } from '@/types';
import { requireAuth, logApiFailure } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!isPathSegment(id)) {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    return handleSubmitDisputeEntry(req, res, id);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSubmitDisputeEntry(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const authToken = requireAuth(req);

    console.log('Submit dispute entry request for contract:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('Dispute entry data:', req.body);

    // Validate request body - handle both formats
    const disputeEntry: SubmitDisputeEntryRequest = {
      ...req.body,
      timestamp: req.body.timestamp || Date.now() // Add timestamp if not provided
    };
    
    if (!disputeEntry.reason) {
      return res.status(400).json({ error: 'Missing required field: reason' });
    }

    // A null figure is a note without a vote (contractservice renders it as "No figure
    // submitted"): the Third Voter's resignation, for one. It must never be coerced to 0,
    // which would read as a real vote of everything to the seller.
    if (disputeEntry.refundPercent == null) {
      disputeEntry.refundPercent = null;
    } else if (disputeEntry.refundPercent < 0 || disputeEntry.refundPercent > 100) {
      return res.status(400).json({ error: 'refundPercent must be between 0 and 100' });
    }

    if (disputeEntry.reason.length > 160) {
      return res.status(400).json({ error: 'reason must be 160 characters or less' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    // Add X-API-Key header if available
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/dispute`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/dispute`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(disputeEntry)
    });

    // contractservice answers its refusals (403 not a party, 404 no such contract) with an empty
    // body, so the body is read as text and only parsed when there is one. Parsing it blindly
    // turned every refusal into a 500.
    const text = await response.text();
    let responseData: unknown = null;
    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = null;
    }
    console.log('Contract Service response:', response.status, responseData);

    if (!response.ok) {
      const message =
        (responseData as { error?: string; message?: string } | null)?.error ??
        (responseData as { message?: string } | null)?.message ??
        (response.status === 403 ? 'Only the buyer, seller or Third Voter can add a dispute entry'
          : response.status === 404 ? 'Contract not found'
          : response.status === 409 ? 'This payment has not been funded, so there is nothing to dispute yet'
          : response.status === 503 ? 'Could not confirm this payment’s funding right now. Try again shortly.'
          : 'Dispute entry was refused');
      return res.status(response.status).json({ error: message });
    }

    res.status(response.status).json(responseData);
  } catch (error) {
    logApiFailure('Submit dispute entry API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}