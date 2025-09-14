import { NextApiRequest, NextApiResponse } from 'next';
import * as cookieFn from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Update email API called with:', {
      userServiceUrl: process.env.USER_SERVICE_URL,
      hasAuthCookie: !!req.headers.cookie,
      email: email
    });

    // Forward request to user service with cookies
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/update-email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify({ email })
    });

    console.log('UserService update email response:', response.status, response.statusText);
    const data = await response.json();

    // Forward any new cookies from the user service
    const cookies = response.headers.getSetCookie();
    cookies.forEach(cookie => {
      const parsedCookie = cookieFn.parse(cookie);
      const cookieDomain = process.env.COOKIE_DOMAIN;
      const fixedCookie = cookie.replace(`Domain=${parsedCookie.Domain};`, `Domain=${cookieDomain};`);
      res.setHeader('Set-Cookie', fixedCookie);
    });

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Update email API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}