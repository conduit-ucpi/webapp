import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, publicOriginHeaders } from '@/lib/server/serviceProxy';

/**
 * The MCP endpoint for the escrow settlement service.
 *
 * An agent connects here and gets tools for working out where a payment must go, settling one
 * with a signature its operator provided, checking what happened, and verifying a receipt.
 *
 * ⚠️ THE CALLER'S CREDENTIAL IS PASSED THROUGH, AND NOTHING HERE CHECKS IT. Every tool call needs
 *    the caller's free access code (`Authorization: Bearer sd_access_…`, set once in their MCP
 *    client's settings, or `?code=` on this address for clients that only take an address) or,
 *    from the pay page, the signed-in session's token and cookies. The
 *    tools hand it on to the API, which admits the call or answers with where to get a code
 *    (ap2service `_require_access`). The handshake and tool list need none, so a client can
 *    connect and an agent can read what it must ask its person for.
 *
 *    The money is safe regardless: a settlement still requires the payer's own EIP-3009
 *    authorization, whose destination is inside what they signed and must equal the address the
 *    terms derive to.
 *
 * ⚠️ A PLAIN PASSTHROUGH, WHICH IS ONLY POSSIBLE BECAUSE THE SERVER IS STATELESS AND ANSWERS
 *    JSON. Streamable HTTP normally replies with an event stream and carries a session across
 *    calls; either would make this a streaming proxy with a buffering hazard rather than four
 *    lines of fetch. Every tool is request-and-response, so the stream would buy nothing.
 */
/** An access code, as userservice makes them. Anything else in `?code=` is ignored. */
const ACCESS_CODE = /^sd_access_[A-Za-z0-9_-]{20,200}$/;

/**
 * The caller's credential: their own Authorization header, or the access code in `?code=`.
 *
 * ⚠️ THE URL FORM IS FOR CLIENTS THAT ONLY ASK FOR AN ADDRESS — Claude.ai and ChatGPT custom
 *    connectors have nowhere to put a header. It becomes the header here and the query is never
 *    passed on, so ap2service and its logs never see the code in a URL; Caddy hides `code` in the
 *    URLs it logs. A header, when sent, wins.
 */
function authorization(req: NextApiRequest): string | undefined {
  if (req.headers.authorization) return req.headers.authorization;
  const code = req.query.code;
  return typeof code === 'string' && ACCESS_CODE.test(code) ? `Bearer ${code}` : undefined;
}

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
        Accept: req.headers.accept ?? 'application/json, text/event-stream',
        ...(authorization(req) ? { Authorization: authorization(req) } : {}),
        ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
        // ⚠️ ORIGIN IS PASSED ON, NOT DECIDED HERE. The MCP spec has the server validate a browser's
        //    Origin (ap2service keeps the allowlist, MCP_ALLOWED_ORIGINS); strip it and the server
        //    sees every request as a non-browser client and the check never runs. A foreign page's
        //    403 comes back through this proxy like any other answer. Real MCP clients send none.
        ...(req.headers.origin ? { Origin: req.headers.origin } : {}),
        // So the tools' answers link the host this client called, not the server's inside one.
        ...publicOriginHeaders(req)
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
