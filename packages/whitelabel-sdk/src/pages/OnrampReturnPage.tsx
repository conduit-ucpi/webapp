import CoinbaseReturnScreen from '@/components/coinbase/CoinbaseReturnScreen';
import { ONRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOnramp';

/**
 * Coinbase's redirectUrl target after a buy. See CoinbaseReturnScreen.
 *
 * ⚠️ MOUNT IT AT /onramp-return. openCoinbaseOnramp sends the buyer back to that exact path
 *    (ONRAMP_RETURN_ROUTE), so a tenant that pays by card without this route returns buyers
 *    to a missing page.
 */
export default function OnrampReturnPage() {
  return <CoinbaseReturnScreen message={ONRAMP_RETURN_MESSAGE} />;
}
