import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard } from '@/lib/server/serviceProxy';

/**
 * The MCP endpoint for the escrow settlement service.
 *
 * An agent connects here and gets tools for working out where a payment must go, settling one
 * with a signature its operator provided, checking what happened, and verifying a receipt.
 *
 * ⚠️ NOTHING HERE HOLDS A KEY, and that is why it needs no credential. A settlement still
 *    requires the payer's own EIP-3009 authorization, whose destination is inside what they
 *    signed and must equal the address the terms derive to. An agent that reaches this endpoint
 *    can no more move somebody's money than a caller of /api/ap2/settle can.
 *
 * ⚠️ A PLAIN PASSTHROUGH, WHICH IS ONLY POSSIBLE BECAUSE THE SERVER IS STATELESS AND ANSWERS
 *    JSON. Streamable HTTP normally replies with an event stream and carries a session across
 *    calls; either would make this a streaming proxy with a buffering hazard rather than four
 *    lines of fetch. Every tool is request-and-response, so the stream would buy nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const upstream = process.env.AP2_SERVICE_URL;
  if (!upstream) {
    return res.status(503).json({ error: 'AP2_SERVICE_URL is not configured' });
  }

  try {
    const response = await fetch(`${upstream}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // MCP clients negotiate both; forwarded so the server answers in the shape asked for.
        Accept: req.headers.accept ?? 'application/json, text/event-stream'
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
    return res.status(response.status).send(text);
  } catch (error) {
    return res.status(502).json({
      error: `Could not reach the settlement service: ${
        error instanceof Error ? error.message : String(error)
      }`
    });
  }
}
