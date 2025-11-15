import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetContracts(req, res);
  }
  
  if (req.method === 'POST') {
    return handleCreateContract(req, res);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetContracts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    console.log('Get pending contracts request');
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    // Add X-API-Key header if available
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      method: 'GET',
      headers
    });

    const responseData = await response.json();
    console.log('Contract Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Get contracts API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function handleCreateContract(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    console.log('Create pending contract request');
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('Request body:', req.body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    // Add X-API-Key header if available
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    // SECURITY: Never log headers - they contain bearer tokens and API keys
    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts`);
    console.log('REQUEST_BODY being sent:', JSON.stringify(req.body, null, 2));

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    console.log('Contract Service response status:', response.status);
    // SECURITY: Don't log response headers - they may contain set-cookie with auth tokens

    if (!response.ok) {
      console.error('Contract Service returned error status:', response.status);
      let errorData;
      try {
        errorData = await response.text();
        console.log('Contract Service error body:', errorData);
        // Try to parse as JSON, fallback to text
        try {
          errorData = JSON.parse(errorData);
        } catch (e) {
          // Keep as text if not valid JSON
        }
      } catch (e) {
        errorData = { error: 'No response body available' };
      }
      return res.status(response.status).json(errorData);
    }

    const responseData = await response.json();
    console.log('Contract Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Create contract API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}