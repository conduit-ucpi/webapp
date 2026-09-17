import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard } from '@/lib/server/serviceProxy';

/**
 * The browsable API reference for the escrow settlement service.
 *
 * ⚠️ HERE BECAUSE EVERYTHING GOES THROUGH THE API LAYER. A caller integrating against
 *    `/api/ap2/settle` should not have to learn a second hostname to read what it accepts, and
 *    ap2service is not directly reachable from every environment the docs are wanted in.
 *
 * ⚠️ THE SPEC URL IN THE RETURNED HTML IS RELATIVE (`../openapi.json`), which is what makes
 *    this work at all. The browser resolves it against the address bar, so a reader at
 *    `/api/ap2/settle/doc` fetches `/api/ap2/openapi.json` — served by the sibling route. Keep
 *    the two at those depths relative to each other or the page loads an empty shell that
 *    still answers 200.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const upstream = process.env.AP2_SERVICE_URL;
  if (!upstream) {
    return res.status(503).json({ error: 'AP2_SERVICE_URL is not configured' });
  }

  const path = req.query.redoc !== undefined ? '/settle/doc/redoc' : '/settle/doc';

  try {
    const response = await fetch(`${upstream}${path}`);
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  } catch (error) {
    // Named, because "the docs are down" and "the docs are misconfigured" are different
    // problems and the person reading this is trying to integrate, not to debug us.
    return res.status(502).json({
      error: `Could not reach the settlement service for its documentation: ${
        error instanceof Error ? error.message : String(error)
      }`
    });
  }
}
