import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard } from '@/lib/server/serviceProxy';

/**
 * The OpenAPI spec for the escrow settlement service.
 *
 * ⚠️ ITS PATH IS LOAD-BEARING. The documentation page at `/api/ap2/settle/doc` carries a
 *    relative `../openapi.json`, which a browser resolves to exactly this route. Move either
 *    one and the docs render an empty shell while still answering 200 — the failure mode this
 *    whole arrangement exists to avoid.
 *
 * Useful on its own too: point a client generator at it rather than transcribing the request
 * shape by hand.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const upstream = process.env.AP2_SERVICE_URL;
  if (!upstream) {
    return res.status(503).json({ error: 'AP2_SERVICE_URL is not configured' });
  }

  try {
    const response = await fetch(`${upstream}/openapi.json`);
    const spec = await response.json();
    return res.status(response.status).json(spec);
  } catch (error) {
    return res.status(502).json({
      error: `Could not reach the settlement service for its spec: ${
        error instanceof Error ? error.message : String(error)
      }`
    });
  }
}
