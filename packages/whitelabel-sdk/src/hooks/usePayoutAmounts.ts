import { useEffect, useRef, useState } from 'react';
import { RpcClient } from '@/lib/rpc/RpcClient';

/**
 * What each escrow will actually pay its recipient, read from the escrows themselves.
 *
 * ⚠️ THE STORED `amount` IS THE GROSS AND IS NOT WHAT ANYONE RECEIVES (§3.1). The recipient
 *    collects `AMOUNT − CREATOR_FEE`; the escrow exposes that as `payoutAmount()`. Showing a
 *    seller the gross overstates what they are owed by the creator fee, on every screen that
 *    does it — and it is the number they compare an early-payment offer against, so the error
 *    flatters the wait and understates the offer.
 *
 * Read from the chain rather than recomputed from the fee schedule: CREATOR_FEE is fixed on
 * each escrow at creation, so a later change to the schedule would silently reprice every
 * existing position if the UI derived it. The chain holds the figure that will actually move.
 *
 * Missing entries are not zeroes. A read that fails leaves the address absent from the map, so
 * callers can fall back to the gross and SAY they are doing so — which is what MakeOfferModal
 * already does — rather than showing a confident wrong number.
 */
export function usePayoutAmounts(
  addresses: string[],
  rpcUrl: string | undefined
): { payouts: Record<string, bigint>; unavailable: string[] } {
  const [payouts, setPayouts] = useState<Record<string, bigint>>({});
  const [unavailable, setUnavailable] = useState<string[]>([]);

  // The array identity changes every render at most call sites; the addresses rarely do.
  // Keying the effect on the contents stops a re-render storm of RPC calls.
  const key = addresses.join(',');
  const addressesRef = useRef(addresses);
  addressesRef.current = addresses;

  useEffect(() => {
    if (!rpcUrl || !key) return;
    let cancelled = false;

    (async () => {
      const client = new RpcClient(rpcUrl);
      const results = await Promise.all(
        addressesRef.current.map(async (address) => {
          try {
            return { address, value: await client.getPayoutAmount(address) };
          } catch (e) {
            console.warn(`Could not read payoutAmount from ${address}:`, e);
            return { address, value: null };
          }
        })
      );
      if (cancelled) return;

      const next: Record<string, bigint> = {};
      const failed: string[] = [];
      for (const { address, value } of results) {
        if (value === null) failed.push(address);
        else next[address] = value;
      }
      setPayouts(next);
      setUnavailable(failed);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, rpcUrl]);

  return { payouts, unavailable };
}
