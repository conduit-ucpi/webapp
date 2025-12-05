/**
 * SIWE Session Endpoint
 *
 * Proxies to backend to get current authenticated session
 * Forwards the AUTH-TOKEN cookie from the request
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/session`, {
      headers: {
        // Forward cookies from client to backend
        Cookie: req.headers.cookie || ''
      }
    })

    if (!response.ok) {
      return res.status(response.status).end()
    }

    const data = await response.json()
    return res.json(data)
  } catch (error) {
    console.error('Error getting session:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
