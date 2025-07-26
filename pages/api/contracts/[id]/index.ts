import { NextApiRequest, NextApiResponse } from 'next';

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
    // Extract the AUTH-TOKEN from cookies
    const cookies = req.headers.cookie || '';
    const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
    const authToken = authTokenMatch ? authTokenMatch[1] : null;

    console.log('Get contract by ID request:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
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
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUpdateContract(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Extract the AUTH-TOKEN from cookies
    const cookies = req.headers.cookie || '';
    const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
    const authToken = authTokenMatch ? authTokenMatch[1] : null;

    console.log('Update contract request:', id);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('Update data:', req.body);

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
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
    res.status(500).json({ error: 'Internal server error' });
  }
}