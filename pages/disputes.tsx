/**
 * Route for the SDK's ArbiterDisputesPage: the escrows the signed-in user is tiebreaker on.
 *
 * As with /dashboard, the page lives in packages/whitelabel-sdk/src/pages so a tenant can mount
 * the same flow; this file only gives it a URL here.
 */
import { ArbiterDisputesPage } from '@conduit-ucpi/whitelabel-sdk';

export default function Disputes() {
  return <ArbiterDisputesPage />;
}
