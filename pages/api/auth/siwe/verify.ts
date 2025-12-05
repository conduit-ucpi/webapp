/**
 * SIWE Signature Verification Endpoint
 *
 * Proxies to backend to verify SIWE signature and create session
 * Forwards the Set-Cookie header to set authentication cookie
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, signature } = req.body

    if (!message || !signature) {
      return res.status(400).json({ error: 'Missing message or signature' })
    }

    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature })
    })

    // Forward Set-Cookie header from backend
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    if (!response.ok) {
      const error = await response.text()
      console.error('Signature verification failed:', error)
      return res.status(response.status).json({ error: 'Verification failed' })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('Error verifying signature:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
