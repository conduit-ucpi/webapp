import { NextApiRequest, NextApiResponse } from 'next';
import { extractAuthToken } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = extractAuthToken(req);
    
    const headers: Record<string, string> = {
      'Cookie': req.headers.cookie || ''
    };
    
    // Include Authorization header if token is available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers
    });

    if (!response.ok) {
      console.error('🔴 User service returned error:', {
        status: response.status,
        statusText: response.statusText,
        url: `${process.env.USER_SERVICE_URL}/api/user/identity`
      });
    }

    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    console.log('🔍 Response from user service:', {
      status: response.status,
      contentType,
      bodyLength: text.length,
      bodyPreview: text.substring(0, 200)
    });

    // Try to parse as JSON, fallback to error object
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('🔴 Failed to parse response as JSON:', {
        text: text.substring(0, 500),
        parseError
      });
      data = { error: 'Invalid response from user service', details: text.substring(0, 200) };
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('🔴 /api/auth/identity error:', error);
    console.error('🔴 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      USER_SERVICE_URL: process.env.USER_SERVICE_URL,
      hasCookie: !!req.headers.cookie
    });
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}