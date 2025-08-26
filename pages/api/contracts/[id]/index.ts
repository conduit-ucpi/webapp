import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method === 'GET') {
    return handleGetContract(req, res, id);
  }
  
  if (req.method === 'PATCH') {
    return handleUpdateContract(req, res, id);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetContract(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const authToken = requireAuth(req);

    console.log('Get contract by ID request:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}`, {
      method: 'GET',
      headers
    });

    const responseData = await response.json();
    console.log('Contract Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Get contract by ID API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function handleUpdateContract(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const authToken = requireAuth(req);

    console.log('Update contract request:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('Update data:', req.body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(req.body)
    });

    const responseData = await response.json();
    console.log('Contract Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Update contract API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}