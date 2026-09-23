/**
 * Route for the SDK's DashboardPage.
 *
 * The page itself lives in packages/whitelabel-sdk/src/pages so a tenant can
 * mount the same flow in their own app. This file exists only to give it a
 * URL here — which makes our own site the first consumer of the SDK rather
 * than a separate implementation that can drift from it.
 */
import { DashboardPage } from '@conduit-ucpi/whitelabel-sdk';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import ReservesOwedList from '@/components/marketplace/ReservesOwedList';

/**
 * Our own mount fills the SDK page's slot with the reserves a supplier is owed.
 *
 * ⚠️ IT BELONGS HERE RATHER THAN ON /liquidity, WHICH IS THE BUYER'S SCREEN. A reserve is owed
 *    to the SUPPLIER — the person who sold a payment early — and the sale drops that contract
 *    out of the list below, so without this they have nowhere at all to see it.
 *
 * Renders nothing for the overwhelming majority who have never sold one, and the slot's
 * `empty:` margin collapses with it rather than leaving a gap.
 */
export default function Dashboard() {
  const { walletAddress } = useWalletAddress();

  return (
    <DashboardPage
      beforeContracts={<ReservesOwedList sellerAddress={walletAddress || undefined} />}
    />
  );
}
