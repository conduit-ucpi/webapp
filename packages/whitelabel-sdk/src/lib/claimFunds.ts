/**
 * Collect a finished payment for its seller, with the relayer sending the transaction.
 *
 * ⚠️ NOTHING IS SIGNED, AND NO GAS IS HANDED OVER. The contract lets anyone call `claimFunds()`
 *    once the payment has matured, and the money can only go to the seller it records. So the
 *    seller's wallet has nothing to prove and nothing to pay: chainservice's relayer sends the
 *    call (`/api/chain/claim-funds-as-gas-payer`) and pays for it.
 *
 *    This used to go through fund-then-send: we topped the seller's wallet up with ETH and had
 *    it send the same call. That handed out gas for a transaction the wallet did not need to
 *    make, and gas handed to a wallet does not have to be spent on what it was asked for
 *    (GAS_SPONSORSHIP_PLAN.md).
 *
 * Resolves with the transaction hash once chainservice has seen the claim succeed on chain.
 * Throws with chainservice's reason when it did not.
 */
export async function claimFundsViaRelayer(
  contractAddress: string,
  post: (url: string, init: RequestInit) => Promise<Response>
): Promise<string> {
  if (!contractAddress) {
    throw new Error('Contract address is required');
  }

  const response = await post('/api/chain/claim-funds-as-gas-payer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractAddress })
  });

  const result: { success?: boolean; transactionHash?: string | null; error?: string } = await response
    .json()
    .catch(() => ({}));
  if (!response.ok || !result.success || !result.transactionHash) {
    throw new Error(result.error || 'The payment could not be collected. Nothing was taken; try again.');
  }
  return result.transactionHash;
}
