import CoinbaseReturnScreen from '@/components/coinbase/CoinbaseReturnScreen';
import { ONRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOnramp';

/** Coinbase's redirectUrl target after a buy. See CoinbaseReturnScreen. */
export default function OnrampReturnPage() {
  return <CoinbaseReturnScreen message={ONRAMP_RETURN_MESSAGE} />;
}
