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

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

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