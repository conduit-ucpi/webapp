/**
 * Shared progress handler for contract transaction sequences
 * Used by both ContractAcceptance and contract-create pages
 */

export interface ContractProgressState {
  setLoadingMessage: (message: string) => void;
  setContractAddress?: (address: string | null) => void;
  updatePaymentStep?: (stepId: string, status: 'active' | 'completed' | 'error') => void;
}

export function createContractProgressHandler(
  state: ContractProgressState,
  stepPrefix: string = 'Step'
) {
  let persistentContractMessage: string | null = null;

  const formatMessage = (currentMessage: string) => {
    if (persistentContractMessage) {
      return `${currentMessage}\n\n${persistentContractMessage}`;
    }
    return currentMessage;
  };

  return (step: string, message: string, contractAddress?: string) => {
    console.log(`🔧 Contract Progress: ${step} - ${message}`);

    // Update UI based on progress step
    switch (step) {
      case 'contract_creation':
        state.setLoadingMessage(formatMessage(`${stepPrefix} 1: Creating secure escrow...`));
        break;
      case 'contract_confirmation':
        state.setLoadingMessage(formatMessage(`${stepPrefix} 1.5: Waiting for contract creation to be confirmed...`));
        break;
      case 'contract_created':
        // Store persistent contract info message
        persistentContractMessage = message;
        state.setContractAddress?.(contractAddress || null);
        state.setLoadingMessage(formatMessage(`${stepPrefix} 1 complete: Contract created successfully`));
        break;
      case 'usdc_approval':
        state.updatePaymentStep?.('approve', 'completed');
        state.updatePaymentStep?.('escrow', 'active');
        state.setLoadingMessage(formatMessage(`${stepPrefix} 2: Approving USDC transfer...`));
        break;
      case 'approval_confirmation':
        state.setLoadingMessage(formatMessage(`${stepPrefix} 2.5: Waiting for USDC approval to be confirmed...`));
        break;
      case 'deposit':
        state.updatePaymentStep?.('escrow', 'completed');
        state.updatePaymentStep?.('confirm', 'active');
        state.setLoadingMessage(formatMessage(`${stepPrefix} 3: Depositing funds...`));
        break;
      case 'deposit_confirmation':
        state.setLoadingMessage(formatMessage(`${stepPrefix} 3.5: Waiting for deposit to be confirmed...`));
        break;
      case 'complete':
        state.updatePaymentStep?.('confirm', 'completed');
        state.updatePaymentStep?.('complete', 'completed');
        state.setLoadingMessage(formatMessage('Transaction sequence completed successfully'));
        break;
    }
  };
}