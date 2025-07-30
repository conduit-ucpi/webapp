import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  try {
    if (req.method === 'GET') {
      // Get contract with notes
      const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/notes`, {
        method: 'GET',
        headers: {
          'Cookie': req.headers.cookie || '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Contract service error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: response.status === 404 ? 'Contract not found' : 'Failed to fetch contract notes' 
        });
      }

      const data = await response.json();
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      // Add admin note
      const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Contract service error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: response.status === 404 ? 'Contract not found' : 'Failed to add note' 
        });
      }

      const data = await response.json();
      return res.status(201).json(data);

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}