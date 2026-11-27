import CoinbaseReturnScreen from '@/components/coinbase/CoinbaseReturnScreen';
import { OFFRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOfframp';

/**
 * Coinbase's redirectUrl target after a cash-out. See CoinbaseReturnScreen.
 *
 * Unlike the onramp's return, arriving here means work is still outstanding: the
 * sell order exists but the tokens have not moved. The message this posts is what
 * tells the page hosting CashOutPanel to look up the order and raise the signature prompt.
 *
 * ⚠️ MOUNT IT AT /offramp-return, the path openCoinbaseOfframp returns to (OFFRAMP_RETURN_ROUTE).
 */
export default function OfframpReturnPage() {
  return <CoinbaseReturnScreen message={OFFRAMP_RETURN_MESSAGE} />;
}
