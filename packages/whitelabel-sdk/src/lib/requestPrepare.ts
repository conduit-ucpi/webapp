/** What ap2service said to a request's prepare: its answer, and whether it was a refusal. */
export interface RequestPrepareAnswer {
  ok: boolean;
  body: any;
}

type Fetcher = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Pay a payment request: the signed-in wallet becomes its buyer, and the answer is how to fund
 * its payment contract. Everything comes from the stored request, so only its id is sent.
 *
 * ⚠️ NO `payer`. Naming one asks for an authorization to sign, which the pay page never uses: it
 *    pays by an ordinary transfer. Building it is a chain read per token, the last thing prepare
 *    waited for on every load, and for a token that cannot be signed for (USDT) one that fails
 *    every time: 2.2s of a 3.7s prepare, measured on production (2026-11-23).
 *
 * Apart from the page so that it can be asked BEFORE the page is drawn: see usePayableContract,
 * which asks at the same moment as it reads the request.
 */
export async function askRequestPrepare(fetcher: Fetcher, id: string): Promise<RequestPrepareAnswer> {
  const response = await fetcher(`/api/ap2/request/${encodeURIComponent(id)}/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
}
