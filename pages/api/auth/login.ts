import { NextApiRequest, NextApiResponse } from 'next';
import * as cookieFn from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Login API called with:', {
      userServiceUrl: process.env.USER_SERVICE_URL,
      authorization: req.headers.authorization ? 'present' : 'missing',
      body: req.body
    });

    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/login`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization || '',
        'X-Clear-Cookies': Array.isArray(req.headers['x-clear-cookies'])
          ? req.headers['x-clear-cookies'][0] || ''
          : req.headers['x-clear-cookies'] || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    console.log('UserService response:', response.status, response.statusText);
    const data = await response.json();

    const cookies = response.headers.getSetCookie();
    cookies.forEach(cookie => {
      const parsedCookie = cookieFn.parse(cookie);
      const cookieDomain = process.env.COOKIE_DOMAIN;
      const fixedCookie = cookie.replace(`Domain=${parsedCookie.Domain};`, `Domain=${cookieDomain};`);
      res.setHeader('Set-Cookie', fixedCookie);
    });


    res.status(response.status).json(data);
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}