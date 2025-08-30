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
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
) {
  const service = new ContractTransactionService(
    { signContractTransaction },
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
      return await service.depositFunds(params);
    },

    /**
     * Complete contract funding: create, approve, and deposit
     */
    fundContract: async (
      params: ContractFundingParams
    ): Promise<ContractFundingResult> => {
      return await service.fundContract(params);
    }
  };
}

/**
 * Web3Auth specific implementation
 * Could have Web3Auth-specific optimizations or error handling
 */
export function createWeb3AuthContractMethods(
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
) {
  const baseMethods = createContractTransactionMethods(signContractTransaction, authenticatedFetch);
  
  return {
    ...baseMethods,
    
    // Web3Auth-specific overrides could go here
    fundContract: async (params: ContractFundingParams): Promise<ContractFundingResult> => {
      console.log('🔧 Web3Auth: Starting contract funding process');
      
      // Could add Web3Auth-specific logic here:
      // - Different error messages
      // - Different progress tracking
      // - Web3Auth-specific optimizations
      
      return await baseMethods.fundContract(params);
    }
  };
}

/**
 * Farcaster specific implementation  
 * Uses eth_sendTransaction instead of signing locally and sending to chainservice
 */
export function createFarcasterContractMethods(
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  walletClient?: any  // Pass wallet client from Farcaster auth provider
) {
  console.log('🔧 createFarcasterContractMethods called with walletClient:', {
    hasWalletClient: !!walletClient,
    hasTransport: !!walletClient?.transport,
    hasRequest: !!walletClient?.transport?.request,
    walletClientKeys: walletClient ? Object.keys(walletClient) : 'undefined'
  });
  
  const baseMethods = createContractTransactionMethods(signContractTransaction, authenticatedFetch);
  
  return {
    ...baseMethods,
    
    // Farcaster-specific USDC approval using eth_sendTransaction
    approveUSDC: async (
      contractAddress: string,
      amount: number,
      currency: string | undefined,
      userAddress: string,
      config: ContractFundingParams['config'],
      utils: ContractFundingParams['utils']
    ): Promise<string> => {
      console.log('🔧 Farcaster: Approving USDC using eth_sendTransaction');
      console.log('🔧 Farcaster: WalletClient check:', {
        hasWalletClient: !!walletClient,
        hasTransport: !!walletClient?.transport,
        hasRequest: !!walletClient?.transport?.request,
        transportType: walletClient?.transport?.type
      });
      
      try {
        // Get wallet client for eth_sendTransaction
        if (!walletClient || !walletClient.transport || !walletClient.transport.request) {
          throw new Error(`Farcaster wallet client not properly initialized: transport=${!!walletClient?.transport}, request=${!!walletClient?.transport?.request}`);
        }

        // Convert to USDC format for approval (preserve precision for Web3)
        const usdcAmount = utils?.toUSDCForWeb3 
          ? utils.toUSDCForWeb3(amount, currency || 'microUSDC') 
          : amount.toString();
        
        const decimals = 6; // USDC has 6 decimals
        const { ethers } = await import('ethers');
        const amountWei = ethers.parseUnits(usdcAmount, decimals);
        
        // Create the transaction request
        const txRequest = {
          from: userAddress,
          to: config.usdcContractAddress,
          data: new ethers.Interface([
            'function approve(address spender, uint256 amount)'
          ]).encodeFunctionData('approve', [contractAddress, amountWei]),
          value: '0x0',
        };

        console.log('🔧 Farcaster: Sending USDC approval via eth_sendTransaction:', txRequest);

        // Use Farcaster's eth_sendTransaction
        const txHash = await walletClient.transport.request({
          method: 'eth_sendTransaction',
          params: [txRequest],
        });

        console.log('🔧 Farcaster: USDC approval transaction hash:', txHash);
        return txHash;

      } catch (error) {
        console.error('🔧 Farcaster: USDC approval failed:', error);
        throw new Error(`Farcaster USDC approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Farcaster-specific fund deposit using eth_sendTransaction
    depositFunds: async (
      params: ContractFundingParams & { contractAddress: string }
    ): Promise<string> => {
      console.log('🔧 Farcaster: Depositing funds using eth_sendTransaction');
      
      try {
        // Get wallet client for eth_sendTransaction
        if (!walletClient || !walletClient.transport) {
          throw new Error('Farcaster wallet client not available');
        }

        const { ethers } = await import('ethers');
        const { contractAddress, userAddress } = params;
        
        // Create the transaction request
        const txRequest = {
          from: userAddress,
          to: contractAddress,
          data: new ethers.Interface([
            'function depositFunds()'
          ]).encodeFunctionData('depositFunds', []),
          value: '0x0',
        };

        console.log('🔧 Farcaster: Sending deposit via eth_sendTransaction:', txRequest);

        // Use Farcaster's eth_sendTransaction
        const txHash = await walletClient.transport.request({
          method: 'eth_sendTransaction',
          params: [txRequest],
        });

        console.log('🔧 Farcaster: Deposit transaction hash:', txHash);

        // Still need to notify backend about successful deposit for email notifications, etc.
        const amountInMicroUSDC = params.utils?.toMicroUSDC 
          ? params.utils.toMicroUSDC(params.contract.amount) 
          : (params.contract.amount * 1000000);

        await authenticatedFetch('/api/chain/deposit-funds-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractAddress,
            userWalletAddress: userAddress,
            transactionHash: txHash,
            contractId: params.contract.id,
            buyerEmail: params.contract.buyerEmail,
            sellerEmail: params.contract.sellerEmail,
            contractDescription: params.contract.description,
            amount: amountInMicroUSDC.toString(),
            currency: "USDC",
            payoutDateTime: params.utils?.formatDateTimeWithTZ 
              ? params.utils.formatDateTimeWithTZ(params.contract.expiryTimestamp) 
              : new Date(params.contract.expiryTimestamp * 1000).toISOString(),
            contractLink: params.config.serviceLink
          })
        });

        return txHash;

      } catch (error) {
        console.error('🔧 Farcaster: Deposit failed:', error);
        throw new Error(`Farcaster deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Override fundContract to use Farcaster-specific implementations
    fundContract: async (params: ContractFundingParams & { onProgress?: (step: string) => void }): Promise<ContractFundingResult> => {
      console.log('🔧 Farcaster: Starting contract funding process with eth_sendTransaction');
      
      try {
        // Step 1: Create contract (still uses chainservice)
        console.log('🔧 Farcaster: Step 1 - Creating contract via chainservice');
        params.onProgress?.('Step 1 of 3: Creating secure escrow...');
        
        const contractAddress = await baseMethods.createContract(
          params.contract, 
          params.userAddress, 
          params.config, 
          params.utils
        );
        console.log('🔧 Farcaster: Step 1 ✅ - Contract created at:', contractAddress);
        params.onProgress?.('Step 2 of 3: Approving USDC transfer...');

        // Add a small delay to let Farcaster process the first transaction
        console.log('🔧 Farcaster: Waiting 2s before USDC approval...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Approve USDC via eth_sendTransaction
        console.log('🔧 Farcaster: Step 2 - Approving USDC via eth_sendTransaction');
        const chainId = walletClient?.chain?.id;
        console.log('🔧 Farcaster: Chain ID:', chainId);
        
        // Check wallet client availability
        if (!walletClient || !walletClient.transport || !walletClient.transport.request) {
          throw new Error(`Farcaster wallet client not available: transport=${!!walletClient?.transport}, request=${!!walletClient?.transport?.request}`);
        }
        
        // Convert to USDC format for approval
        const usdcAmount = params.utils?.toUSDCForWeb3 
          ? params.utils.toUSDCForWeb3(params.contract.amount, params.contract.currency || 'microUSDC') 
          : params.contract.amount.toString();
        
        const decimals = 6; // USDC has 6 decimals
        const { ethers } = await import('ethers');
        const amountWei = ethers.parseUnits(usdcAmount, decimals);
        
        console.log('🔧 Farcaster: WalletClient state before eth_sendTransaction:', {
          hasWalletClient: !!walletClient,
          hasTransport: !!walletClient?.transport,
          hasRequest: !!walletClient?.transport?.request,
          transportType: walletClient?.transport?.type,
          chainId: walletClient?.chain?.id,
          chainName: walletClient?.chain?.name
        });
        
        // Estimate gas for USDC approval
        const approvalTxRequest = {
          from: params.userAddress,
          to: params.config.usdcContractAddress,
          data: new ethers.Interface([
            'function approve(address spender, uint256 amount)'
          ]).encodeFunctionData('approve', [contractAddress, amountWei]),
          value: '0x0',
        };

        try {
          const gasEstimate = await walletClient.transport.request({
            method: 'eth_estimateGas',
            params: [approvalTxRequest],
          });
          
          const gasPrice = await walletClient.transport.request({
            method: 'eth_gasPrice',
            params: [],
          });
          
          const gasEstimateDecimal = parseInt(gasEstimate, 16);
          const gasPriceDecimal = parseInt(gasPrice, 16);
          const totalGasCostWei = gasEstimateDecimal * gasPriceDecimal;
          const totalGasCostEth = ethers.formatEther(totalGasCostWei.toString());
          
          console.log('🔧 Farcaster: USDC approval gas estimation:', {
            gasEstimate: gasEstimate,
            gasEstimateDecimal: gasEstimateDecimal.toLocaleString(),
            gasPrice: gasPrice,
            gasPriceGwei: ethers.formatUnits(gasPriceDecimal.toString(), 'gwei'),
            totalGasCostWei: totalGasCostWei.toString(),
            totalGasCostEth: totalGasCostEth,
            totalGasCostUSD: `~$${(parseFloat(totalGasCostEth) * 2500).toFixed(4)}`
          });
        } catch (gasError) {
          console.error('🔧 Farcaster: USDC approval gas estimation failed:', gasError);
        }

        let approvalTxHash: string;
        try {
          // Use walletClient.sendTransaction method
          console.log('🔧 Farcaster: Using walletClient.sendTransaction method');
          approvalTxHash = await walletClient.sendTransaction({
            to: params.config.usdcContractAddress,
            data: new ethers.Interface([
              'function approve(address spender, uint256 amount)'
            ]).encodeFunctionData('approve', [contractAddress, amountWei]),
            value: BigInt(0),
            account: walletClient.account,
            chain: walletClient.chain
          });
          console.log('🔧 Farcaster: sendTransaction response:', approvalTxHash);
        } catch (txError) {
          console.error('🔧 Farcaster: USDC approval failed:', txError);
          throw txError;
        }
        
        console.log('🔧 Farcaster: Step 2 ✅ - USDC approved via eth_sendTransaction, tx:', approvalTxHash);
        params.onProgress?.('Step 3 of 3: Depositing funds to escrow...');

        // Add another small delay before deposit
        console.log('🔧 Farcaster: Waiting 2s before deposit...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Deposit funds with eth_sendTransaction
        console.log('🔧 Farcaster: Step 3 - Depositing funds via eth_sendTransaction');
        
        // Create the deposit transaction request
        const depositTxRequest = {
          from: params.userAddress,
          to: contractAddress,
          data: new ethers.Interface([
            'function depositFunds()'
          ]).encodeFunctionData('depositFunds', []),
          value: '0x0',
        };

        // Estimate gas for the deposit transaction
        try {
          const gasEstimate = await walletClient.transport.request({
            method: 'eth_estimateGas',
            params: [depositTxRequest],
          });
          
          // Get current gas price
          const gasPrice = await walletClient.transport.request({
            method: 'eth_gasPrice',
            params: [],
          });
          
          const gasEstimateDecimal = parseInt(gasEstimate, 16);
          const gasPriceDecimal = parseInt(gasPrice, 16);
          const totalGasCostWei = gasEstimateDecimal * gasPriceDecimal;
          const totalGasCostEth = ethers.formatEther(totalGasCostWei.toString());
          
          console.log('🔧 Farcaster: Deposit transaction gas estimation:', {
            gasEstimate: gasEstimate,
            gasEstimateDecimal: gasEstimateDecimal.toLocaleString(),
            gasPrice: gasPrice,
            gasPriceGwei: ethers.formatUnits(gasPriceDecimal.toString(), 'gwei'),
            totalGasCostWei: totalGasCostWei.toString(),
            totalGasCostEth: totalGasCostEth,
            totalGasCostUSD: `~$${(parseFloat(totalGasCostEth) * 2500).toFixed(4)}`
          });
          
          // Check user's balance
          const userBalance = await walletClient.transport.request({
            method: 'eth_getBalance',
            params: [params.userAddress, 'latest'],
          });
          const userBalanceDecimal = parseInt(userBalance, 16);
          const userBalanceEth = ethers.formatEther(userBalanceDecimal.toString());
          
          console.log('🔧 Farcaster: User balance check:', {
            balanceWei: userBalance,
            balanceEth: userBalanceEth,
            balanceUSD: `~$${(parseFloat(userBalanceEth) * 2500).toFixed(4)}`,
            hasEnoughGas: userBalanceDecimal > totalGasCostWei,
            shortfallWei: userBalanceDecimal > totalGasCostWei ? 0 : (totalGasCostWei - userBalanceDecimal).toString(),
            shortfallEth: userBalanceDecimal > totalGasCostWei ? 0 : ethers.formatEther((totalGasCostWei - userBalanceDecimal).toString())
          });
          
        } catch (gasError) {
          console.error('🔧 Farcaster: Gas estimation failed:', gasError);
        }

        console.log('🔧 Farcaster: Sending deposit via eth_sendTransaction:', depositTxRequest);
        
        const depositTxHash = await walletClient.transport.request({
          method: 'eth_sendTransaction',
          params: [depositTxRequest],
        });
        
        console.log('🔧 Farcaster: Step 3 ✅ - Funds deposited, tx:', depositTxHash);
        
        // Notify backend about successful deposit for email notifications
        const amountInMicroUSDC = params.utils?.toMicroUSDC 
          ? params.utils.toMicroUSDC(params.contract.amount) 
          : (params.contract.amount * 1000000);

        await authenticatedFetch('/api/chain/deposit-funds-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractAddress,
            userWalletAddress: params.userAddress,
            transactionHash: depositTxHash,
            contractId: params.contract.id,
            buyerEmail: params.contract.buyerEmail,
            sellerEmail: params.contract.sellerEmail,
            contractDescription: params.contract.description,
            amount: amountInMicroUSDC.toString(),
            currency: "USDC",
            payoutDateTime: params.utils?.formatDateTimeWithTZ 
              ? params.utils.formatDateTimeWithTZ(params.contract.expiryTimestamp) 
              : new Date(params.contract.expiryTimestamp * 1000).toISOString(),
            contractLink: params.config.serviceLink
          })
        });

        return {
          contractAddress,
          approvalTxHash,
          depositTxHash
        };

      } catch (error) {
        console.error('🔧 Farcaster: Contract funding failed:', error);
        console.error('🔧 Farcaster: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw error;
      }
    }
  };
}