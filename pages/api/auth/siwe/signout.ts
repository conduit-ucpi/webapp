/**
 * SIWE Sign Out Endpoint
 *
 * Proxies to backend to sign out and clear session
 * Forwards the Set-Cookie header to clear the authentication cookie
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/signout`, {
      method: 'POST'
    })

    // Forward Set-Cookie header to clear cookie
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    const data = await response.json()
    return res.json(data)
  } catch (error) {
    console.error('Error signing out:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
