import { useEffect, useRef, useState } from 'react';
import { RpcClient } from '@/lib/rpc/RpcClient';

/**
 * Reading one value per escrow, straight from the chain.
 *
 * Marketplace screens keep needing this shape: a list of escrows, one figure each, and no
 * useful way to get it from our own records. Written once because the fiddly parts are the
 * same every time and getting either wrong is quiet rather than loud.
 *
 * ⚠️ A FAILED READ IS ABSENT, NOT ZERO. Callers must be able to tell "not read" from "read and
 *    it was nothing" — a zero payout on a funded escrow, or an epoch-zero maturity, renders as
 *    a confident lie. Absent lets the caller fall back and say it is falling back.
 */
export function useChainReads<T>(
  addresses: string[],
  rpcUrl: string | undefined,
  read: (client: RpcClient, address: string) => Promise<T>
): { values: Record<string, T>; unavailable: string[] } {
  const [values, setValues] = useState<Record<string, T>>({});
  const [unavailable, setUnavailable] = useState<string[]>([]);

  // Call sites build both the array and the reader inline, so both get a fresh identity every
  // render while the addresses themselves rarely change. Keying the effect on the CONTENTS is
  // what stops one list becoming an unbounded stream of RPC calls.
  const key = addresses.join(',');
  const addressesRef = useRef(addresses);
  const readRef = useRef(read);
  addressesRef.current = addresses;
  readRef.current = read;

  useEffect(() => {
    if (!rpcUrl || !key) return;
    let cancelled = false;

    (async () => {
      const client = new RpcClient(rpcUrl);
      const results = await Promise.all(
        addressesRef.current.map(async (address) => {
          try {
            return { address, value: await readRef.current(client, address) };
          } catch (e) {
            console.warn(`Chain read failed for ${address}:`, e);
            return { address, value: undefined };
          }
        })
      );
      if (cancelled) return;

      const next: Record<string, T> = {};
      const failed: string[] = [];
      for (const { address, value } of results) {
        if (value === undefined) failed.push(address);
        else next[address] = value as T;
      }
      setValues(next);
      setUnavailable(failed);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, rpcUrl]);

  return { values, unavailable };
}

/**
 * What each escrow will actually pay its recipient.
 *
 * ⚠️ THE STORED `amount` IS THE GROSS AND IS NOT WHAT ANYONE RECEIVES (§3.1). The recipient
 *    collects `AMOUNT − CREATOR_FEE`, which the escrow exposes as `payoutAmount()`. Showing a
 *    seller the gross overstates what they are owed by the platform fee — and it is the figure
 *    they weigh an early-payment offer against, so the error flatters waiting.
 *
 * Read from the chain rather than recomputed from the fee schedule: CREATOR_FEE is fixed on
 * each escrow at creation, so a later change to the schedule would silently reprice every
 * existing position if the UI derived it.
 */
export function usePayoutAmounts(
  addresses: string[],
  rpcUrl: string | undefined
): { payouts: Record<string, bigint>; unavailable: string[] } {
  const { values, unavailable } = useChainReads(addresses, rpcUrl, (client, address) =>
    client.getPayoutAmount(address)
  );
  return { payouts: values, unavailable };
}

/**
 * When each escrow matures, as a unix timestamp.
 *
 * Maturity is the LP's primary risk metric — it is the remaining dispute window, the whole
 * period during which the position can still be taken away from them — so it belongs on any
 * screen showing their offers, not just on the one where they made the bid.
 *
 * Not on OfferView: the offer book indexes the OFFER, and maturity is a property of the escrow
 * underneath it.
 */
export function useEscrowMaturities(
  addresses: string[],
  rpcUrl: string | undefined
): { maturities: Record<string, number>; unavailable: string[] } {
  const { values, unavailable } = useChainReads(addresses, rpcUrl, async (client, address) => {
    const terms = await client.getEscrowTerms(address);
    return Number(terms.expiryTimestamp);
  });
  return { maturities: values, unavailable };
}
