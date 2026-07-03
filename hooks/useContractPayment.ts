import { useCallback } from 'react';
import {
  executeDirectPaymentSequence,
  executeContractTransactionSequence,
} from '@/utils/contractTransactionSequence';
import { createContractProgressHandler } from '@/utils/contractProgressHandler';

/**
 * Shared payment orchestration for contract-create and contract-pay.
 *
 * Both pages had near-identical handleWalletPayment (direct transfer) and
 * handleLegacyPayment (approve+deposit) handlers. The SHARED core lives here:
 * balance check (throw on insufficient), the verify step + brief pause, the
 * sequence call with the canonical onProgress→step wiring, and error-step
 * marking. The PAGE-SPECIFIC tails (create: webhook + Shopify + postMessage +
 * WordPress redirect; pay: router.push; their differing error handling) are
 * injected as onSuccess(result) / onError(error) so they stay in the pages.
 *
 * Behavior is a verbatim extraction — message text, step labels, the 500ms
 * verify pause, and the onProgress switch are unchanged. The actual signing is
 * delegated to the same sequence utilities as before.
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
  approveUSDC: (...args: any[]) => Promise<any>;
  depositToContract: (...args: any[]) => Promise<any>;
  depositFundsAsProxy: (...args: any[]) => Promise<any>;
  getWeb3Service: () => Promise<any>;
  updatePaymentStep: (stepId: string, status: 'active' | 'completed' | 'error') => void;
  setLoadingMessage: (msg: string) => void;
  /** The page's "payment in progress" flag setter (setIsLoading / setIsPaymentInProgress). */
  setBusy: (busy: boolean) => void;
  /** Returns the currently-active PaymentStep (to mark it errored), or undefined. */
  getActiveStep: () => { id: string } | undefined;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
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

async function runVerifyStep(deps: PaymentDeps): Promise<void> {
  deps.updatePaymentStep('verify', 'active');
  deps.setLoadingMessage('Verifying wallet connection...');
  await new Promise((resolve) => setTimeout(resolve, 500));
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
        await runVerifyStep(deps);

        deps.updatePaymentStep('transfer', 'active');
        deps.setLoadingMessage('Creating contract and transferring funds...');

        const result = await executeDirectPaymentSequence(params, {
          authenticatedFetch: deps.authenticatedFetch as any,
          transferToContract: deps.transferToContract,
          getWeb3Service: deps.getWeb3Service,
          onProgress: (step, _message, _contractAddr) => {
            switch (step) {
              case 'contract_creation':
                deps.setLoadingMessage('Setting up your secure escrow...');
                break;
              case 'contract_confirmation':
                deps.setLoadingMessage('Waiting for the escrow to be confirmed...');
                break;
              case 'contract_created':
                deps.setLoadingMessage('Escrow ready');
                break;
              case 'transfer':
                deps.updatePaymentStep('transfer', 'active');
                deps.setLoadingMessage('Moving your funds into escrow...');
                break;
              case 'transfer_confirmation':
                deps.updatePaymentStep('transfer', 'completed');
                deps.updatePaymentStep('confirm', 'active');
                deps.setLoadingMessage('Confirming your payment...');
                break;
              case 'activation':
                deps.updatePaymentStep('confirm', 'completed');
                deps.updatePaymentStep('activate', 'active');
                deps.setLoadingMessage('Finalizing...');
                break;
              case 'complete':
                deps.updatePaymentStep('activate', 'completed');
                deps.updatePaymentStep('complete', 'completed');
                deps.setLoadingMessage('Payment completed successfully!');
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

  const runLegacyPayment = useCallback(
    async (params: ContractPaymentParams, deps: PaymentDeps) => {
      deps.setBusy(true);
      try {
        assertSufficientBalance(deps);
        await runVerifyStep(deps);

        deps.updatePaymentStep('approve', 'active');

        const result = await executeContractTransactionSequence(params, {
          authenticatedFetch: deps.authenticatedFetch as any,
          approveUSDC: deps.approveUSDC,
          depositToContract: deps.depositToContract,
          depositFundsAsProxy: deps.depositFundsAsProxy,
          getWeb3Service: deps.getWeb3Service,
          onProgress: createContractProgressHandler(
            {
              setLoadingMessage: deps.setLoadingMessage,
              updatePaymentStep: deps.updatePaymentStep,
            },
            'Step'
          ),
          useProxyDeposit: true,
        });

        deps.onSuccess(result);
      } catch (error: any) {
        handlePaymentError(error, deps);
      }
    },
    []
  );

  return { runDirectPayment, runLegacyPayment };
}
