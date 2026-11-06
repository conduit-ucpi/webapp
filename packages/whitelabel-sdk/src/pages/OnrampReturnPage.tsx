import { useEffect } from 'react';
import { useRouter } from 'next/router';
import CoinbaseReturnScreen from '@/components/coinbase/CoinbaseReturnScreen';
import { ONRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOnramp';
import { reportOnrampReturned } from '@/lib/reportOnrampReturned';

/**
 * Coinbase's redirectUrl target after a buy. See CoinbaseReturnScreen.
 *
 * ⚠️ MOUNT IT AT /onramp-return. openCoinbaseOnramp sends the buyer back to that exact path
 *    (ONRAMP_RETURN_ROUTE), so a tenant that pays by card without this route returns buyers
 *    to a missing page.
 */
export default function OnrampReturnPage() {
  const router = useRouter();
  const { isReady, query } = router;
  const returnPath = query.return;

  useEffect(() => {
    if (isReady) void reportOnrampReturned(returnPath);
  }, [isReady, returnPath]);

  return <CoinbaseReturnScreen message={ONRAMP_RETURN_MESSAGE} />;
}
