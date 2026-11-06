import type { FundWalletRequest, FundWalletResult } from '@/lib/auth/types/unified-provider';

/**
 * Our funding request in the shape of Privy's depositFunds, and its answer in ours. Kept apart from
 * PrivyHost so it can be tested without Privy.
 *
 * Fiat only, for now. Privy's crypto deposits need a Privy wallet (depositFunds throws for an
 * external one) and cost the app gas, and AddFundsModal already offers a transfer from another wallet.
 *
 * ⚠️ THE AMOUNT IS ONLY A STARTING POINT. It is in tokens, and Privy takes it as a fiat amount in
 *    whichever currency is selected. Starting in USD makes it about right for a dollar stablecoin,
 *    but Privy keeps the number when the buyer changes currency: 32.39 USDC became 32.39 MXN when
 *    tried on 2026-11-06, under $2. Short purchases stay in the buyer's wallet, and they can edit it.
 */
export function depositFundsOptions(address: string, request: FundWalletRequest, chainId: number) {
  return {
    destination: {
      wallet: address,
      chain: `eip155:${chainId}`,
      asset: request.asset === 'USDC' ? 'usdc' : request.asset.erc20,
    },
    fiat: { source: { defaultAsset: 'usd' as const }, defaultAmount: request.amount },
  };
}

/** How Privy says the buyer closed its window. It rejects, where the old hook resolved. */
const USER_EXIT = /cancel|exited/i;

/** Closing the window is a choice, not a failure. Anything else is still thrown, to be shown. */
export async function fundWalletResult(deposit: Promise<unknown>): Promise<FundWalletResult> {
  try {
    const result = (await deposit) as { status?: string } | undefined;
    return { status: 'completed', detail: result?.status };
  } catch (error) {
    if (error instanceof Error && USER_EXIT.test(error.message)) {
      return { status: 'cancelled', detail: error.message };
    }
    throw error;
  }
}
