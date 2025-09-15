import { ContractTransactionService } from './contractTransactions';
import { 
  ContractTransactionParams, 
  ContractFundingParams, 
  ContractFundingResult 
} from '@/components/auth/authInterface';

/**
 * Factory to create contract transaction methods for auth providers
 * This allows different implementations for Web3Auth vs Farcaster
 */
export function createContractTransactionMethods(
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  fundAndSendTransaction?: (txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }) => Promise<string>
) {
  const service = new ContractTransactionService(
    { signContractTransaction, fundAndSendTransaction },
    { authenticatedFetch }
  );

  return {
    /**
     * Create a new escrow contract on-chain
     */
    createContract: async (
      contract: ContractFundingParams['contract'],
      userAddress: string,
      config: ContractFundingParams['config'],
      utils: ContractFundingParams['utils']
    ): Promise<string> => {
      return await service.createContract(contract, userAddress, config, utils);
    },

    /**
     * Approve USDC spending for escrow contract
     * Generic implementation using signContractTransaction
     */
    approveUSDC: async (
      contractAddress: string,
      amount: number,
      currency: string | undefined,
      userAddress: string,
      config: ContractFundingParams['config'],
      utils: ContractFundingParams['utils']
    ): Promise<string> => {
      return await service.approveUSDC(contractAddress, amount, currency, userAddress, config, utils);
    },

    /**
     * Deposit funds to escrow contract
     */
    depositFunds: async (
      params: ContractFundingParams & { contractAddress: string }
    ): Promise<string> => {
      return await service.depositAndSendFunds(params);
    },

    /**
     * Complete contract funding: create, approve, and deposit
     * This base implementation uses the ContractTransactionService
     */
    fundContract: async (
      params: ContractFundingParams
    ): Promise<ContractFundingResult> => {
      console.log('🔧 Base: Using ContractTransactionService for fundAndSendContract');
      
      if (!fundAndSendTransaction) {
        throw new Error('fundAndSendTransaction not available - direct RPC transactions required');
      }
      
      // Use the real service implementation
      const { ContractTransactionService } = await import('./contractTransactions');
      const service = new ContractTransactionService(
        { signContractTransaction, fundAndSendTransaction },
        { authenticatedFetch }
      );
      
      return await service.fundAndSendContract(params);
    },

    /**
     * Claim funds from expired escrow contract
     * Base implementation using signContractTransaction + backend
     */
    claimFunds: async (
      contractAddress: string,
      userAddress: string
    ): Promise<string> => {
      console.log('🔧 Base: Claiming funds via chainservice as gas payer');
      
      // Call chainservice to handle the transaction and pay gas
      const response = await authenticatedFetch('/api/chain/claim-funds-as-gas-payer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to claim funds');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }

      return result.transactionHash;
    },

    /**
     * Raise dispute for active escrow contract
     * Base implementation using signContractTransaction + backend
     */
    raiseDispute: async (params: {
      contractAddress: string;
      userAddress: string;
      reason: string;
      refundPercent: number;
      contract?: {
        id: string;
      };
    }): Promise<string> => {
      console.log('🔧 Base: Raising dispute via signContractTransaction + backend');
      
      const { contractAddress, userAddress, reason, refundPercent, contract } = params;
      
      // Import the ESCROW_CONTRACT_ABI
      const { ESCROW_CONTRACT_ABI } = await import('../lib/web3');
      
      // Sign the raiseDispute transaction
      const signedTx = await signContractTransaction({
        contractAddress,
        abi: ESCROW_CONTRACT_ABI,
        functionName: 'raiseDispute',
        functionArgs: [],
        debugLabel: 'DISPUTE'
      });

      // Build the simplified dispute request (email notifications handled by emailservice now)
      const disputeRequest: any = {
        contractAddress,
        userWalletAddress: userAddress,
        signedTransaction: signedTx,
        reason,
        refundPercent
      };

      // Add database ID if provided
      if (contract?.id) {
        disputeRequest.databaseId = contract.id;
      }

      // Submit signed transaction to chain service
      const response = await authenticatedFetch('/api/chain/raise-dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(disputeRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to raise dispute');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Dispute failed');
      }

      return result.transactionHash || signedTx;
    }
  };
}

/**
 * Web3Auth specific implementation
 * Uses direct blockchain transactions with automatic gas funding
 */
export function createWeb3AuthContractMethods(
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  fundAndSendTransaction: (txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }) => Promise<string>
) {
  const baseMethods = createContractTransactionMethods(signContractTransaction, authenticatedFetch, fundAndSendTransaction);
  
  return {
    ...baseMethods,
    
    // Web3Auth uses the base approveUSDC method (via signContractTransaction + chainservice)
    // No override needed - the base method handles the conversion correctly
    
    // Web3Auth-specific fundContract: use the actual service implementation
    fundContract: async (params: ContractFundingParams): Promise<ContractFundingResult> => {
      console.log('🔧 Web3Auth: Starting contract funding process via direct blockchain transactions');
      
      const service = new (await import('./contractTransactions')).ContractTransactionService(
        { signContractTransaction, fundAndSendTransaction },
        { authenticatedFetch }
      );
      
      return await service.fundAndSendContract(params);
    },

    // Web3Auth uses direct blockchain claim funds method
    claimFunds: async (contractAddress: string, userAddress: string): Promise<string> => {
      console.log('🔧 Web3Auth: Claiming funds via direct blockchain transactions');
      
      const service = new (await import('./contractTransactions')).ContractTransactionService(
        { signContractTransaction, fundAndSendTransaction },
        { authenticatedFetch }
      );
      
      return await service.claimAndSendFunds({ contractAddress, userAddress });
    },

    // Web3Auth uses direct blockchain raise dispute method
    raiseDispute: async (params: { 
      contractAddress: string; 
      userAddress: string; 
      reason: string; 
      refundPercent: number; 
      contract?: { id: string; }; 
    }): Promise<string> => {
      console.log('🔧 Web3Auth: Raising dispute via direct blockchain transactions');
      
      const service = new (await import('./contractTransactions')).ContractTransactionService(
        { signContractTransaction, fundAndSendTransaction },
        { authenticatedFetch }
      );
      
      return await service.raiseAndSendDispute(params);
    }
  };
}

/**
 * Farcaster now uses the same Web3Auth contract methods
 * This function is kept for backwards compatibility but simply delegates to Web3Auth implementation
 * 
 * @deprecated Use createWeb3AuthContractMethods directly - Farcaster and Web3Auth now use the same implementation
 */
export function createFarcasterContractMethods(
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  walletClient?: any,  // Not used anymore - kept for compatibility
  fundAndSendTransaction?: (txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }) => Promise<string>
) {
  console.log('🔧 createFarcasterContractMethods: Delegating to Web3Auth implementation');
  
  // Simply delegate to the Web3Auth implementation - no Farcaster-specific code needed
  // If fundAndSendTransaction is undefined, use a placeholder that throws an error
  const safeFundAndSendTransaction = fundAndSendTransaction || (async () => {
    throw new Error('fundAndSendTransaction not available - provider not properly initialized');
  });
  
  return createWeb3AuthContractMethods(
    signContractTransaction,
    authenticatedFetch,
    safeFundAndSendTransaction
  );
}
