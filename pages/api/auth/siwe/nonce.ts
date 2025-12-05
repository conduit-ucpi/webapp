/**
 * SIWE Nonce Generation Endpoint
 *
 * Proxies to backend to get a cryptographically secure nonce
 * The nonce prevents replay attacks
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/nonce`)

    if (!response.ok) {
      console.error('Failed to get nonce from backend:', response.statusText)
      return res.status(response.status).json({ error: 'Failed to get nonce' })
    }

    const data = await response.json()
    return res.json(data)
  } catch (error) {
    console.error('Error getting nonce:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
