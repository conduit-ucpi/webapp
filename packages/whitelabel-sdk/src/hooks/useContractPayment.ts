import { useCallback } from 'react';
import { executeDirectPaymentSequence } from '@/utils/contractTransactionSequence';
import { resolveEscrowAddressSources } from '@/lib/escrow/escrowAddressSources';

/**
 * Shared payment orchestration for contract-create and contract-pay.
 *
 * Both pages had a near-identical handleWalletPayment. The SHARED core lives here: balance
 * check (throw on insufficient), the verify step + brief pause, the sequence call with the
 * canonical onProgress→step wiring, and error-step marking. The PAGE-SPECIFIC tails (create:
 * webhook + Shopify + postMessage + WordPress redirect; pay: router.push; their differing
 * error handling) are injected as onSuccess(result) / onError(error) so they stay in the pages.
 *
 * The approve-and-deposit half that used to live here is gone: neither page ever called it.
 * That sequence is still used by ContractAcceptance on the dashboard, which calls
 * executeContractTransactionSequence directly.
 */

// The on-chain params both pages already construct. arbiterAddress is optional
// (pay passes it for custom-arbiter contracts; create omits it).
export interface ContractPaymentParams {
  contractserviceId: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: number; // microUSDC
  expiryTimestamp: number;
  description: string;
  arbiterAddress?: string;
}

interface PaymentDeps {
  selectedTokenSymbol: string;
  /** Wallet balance in token units, as a string (parseFloat'd here). */
  tokenBalance: string;
  /** Required amount in token units. */
  requiredAmount: number;
  authenticatedFetch: ((url: string, options?: RequestInit) => Promise<Response>) | undefined;
  transferToContract: (tokenAddress: string, contractAddress: string, amount: string) => Promise<string>;
  getWeb3Service: () => Promise<any>;
  updatePaymentStep: (stepId: string, status: 'active' | 'completed' | 'error') => void;
  setLoadingMessage: (msg: string) => void;
  /** The page's "payment in progress" flag setter (setIsLoading / setIsPaymentInProgress). */
  setBusy: (busy: boolean) => void;
  /** Returns the currently-active PaymentStep (to mark it errored), or undefined. */
  getActiveStep: () => { id: string } | undefined;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
  /**
   * The factory, implementation and default arbiter an escrow's address is derived from,
   * as published by /api/config.
   *
   * Injected rather than read from ConfigProvider so this hook stays usable wherever the
   * pages are — the rest of its inputs arrive the same way, and reaching into context here
   * would tie every consumer to a provider it does not otherwise need.
   */
  contractFactoryAddress?: string;
  implementationAddress?: string;
  defaultArbiterAddress?: string;
  /**
   * The escrow address, when the page derived and recorded it while waiting to be clicked.
   *
   * ⚠️ THE POINT OF PREPARING EARLY IS THAT THE CLICK DOES LESS. Deriving the address is free
   *    and recording it is one request, and neither needs the user — so doing them on the click
   *    put two round trips between pressing Pay and the wallet opening, for work that could
   *    have finished while the page sat there.
   */
  preparedAddress?: string;
}

function assertSufficientBalance(deps: PaymentDeps): void {
  const available = parseFloat(deps.tokenBalance);
  const required = deps.requiredAmount;
  if (available < required) {
    const shortfall = required - available;
    throw new Error(
      `Insufficient ${deps.selectedTokenSymbol} balance. You need ${required.toFixed(4)} ${deps.selectedTokenSymbol} but only have ${available.toFixed(4)} ${deps.selectedTokenSymbol}. You are short ${shortfall.toFixed(4)} ${deps.selectedTokenSymbol}.`
    );
  }
}

function markWalletChecked(deps: PaymentDeps): void {
  // ⚠️ THIS USED TO SLEEP FOR HALF A SECOND AND CHECK NOTHING. The actual check is
  //    assertSufficientBalance above, which is synchronous and runs against a balance the page
  //    loaded long ago — so the pause existed only to let a tick mark appear at a readable
  //    speed. It charged every payer 500ms to watch a checkbox, on the one screen where the
  //    wait is the thing people complain about.
  //
  //    The step stays in the list because the check is real and worth showing; it is simply
  //    already true by the time anyone presses the button.
  deps.updatePaymentStep('verify', 'completed');
}

function handlePaymentError(error: any, deps: PaymentDeps): void {
  const activeStep = deps.getActiveStep();
  if (activeStep) {
    deps.updatePaymentStep(activeStep.id, 'error');
  }
  deps.setBusy(false);
  deps.setLoadingMessage('');
  deps.onError(error instanceof Error ? error : new Error(String(error?.message || error)));
}

export function useContractPayment() {
  const runDirectPayment = useCallback(
    async (params: ContractPaymentParams, deps: PaymentDeps) => {
      deps.setBusy(true);
      try {
        assertSufficientBalance(deps);
        markWalletChecked(deps);

        deps.updatePaymentStep('transfer', 'active');
        deps.setLoadingMessage('Working out the escrow address...');

        // The escrow address is computed from these, so a missing one is not something to
        // paper over with a default: it would produce an address the factory can never deploy
        // to, and funds sent there could not be recovered by anyone.
        // Not merely "are these present". Whoever supplies the factory and implementation
        // decides where the buyer's money lands, so build-time values win over whatever the
        // API said, and a disagreement between them is refused outright.
        const sources = resolveEscrowAddressSources({
          factoryAddress: deps.contractFactoryAddress,
          implementationAddress: deps.implementationAddress,
          defaultArbiterAddress: deps.defaultArbiterAddress
        });

        const result = await executeDirectPaymentSequence(params, {
          authenticatedFetch: deps.authenticatedFetch as any,
          transferToContract: deps.transferToContract,
          getWeb3Service: deps.getWeb3Service,
          factoryAddress: sources.factoryAddress,
          implementationAddress: sources.implementationAddress,
          defaultArbiterAddress: sources.defaultArbiterAddress,
          preparedAddress: deps.preparedAddress,
          onProgress: (step, _message, _contractAddr) => {
            switch (step) {
              // The escrow is no longer deployed before payment, so there is no creation
              // transaction to announce or wait on. Its address is computed instead, which
              // takes no time worth reporting.
              case 'address_reserved':
                deps.updatePaymentStep('address', 'completed');
                break;
              case 'transfer':
                deps.updatePaymentStep('transfer', 'active');
                deps.setLoadingMessage('Sending funds to the escrow address...');
                break;
              case 'transfer_confirmation':
                deps.updatePaymentStep('transfer', 'completed');
                deps.updatePaymentStep('confirm', 'active');
                deps.setLoadingMessage('Waiting for your transfer to confirm...');
                break;
              case 'activation':
                deps.updatePaymentStep('confirm', 'completed');
                deps.updatePaymentStep('activate', 'active');
                deps.setLoadingMessage('Creating the escrow around your funds...');
                break;
              case 'complete':
                deps.updatePaymentStep('activate', 'completed');
                deps.updatePaymentStep('complete', 'completed');
                deps.setLoadingMessage('Funds secured in escrow.');
                break;
            }
          },
        });

        deps.onSuccess(result);
      } catch (error: any) {
        handlePaymentError(error, deps);
      }
    },
    []
  );

  return { runDirectPayment };
}
