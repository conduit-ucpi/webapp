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
      return await service.depositFunds(params);
    },

    /**
     * Complete contract funding: create, approve, and deposit
     * This should be overridden by provider-specific implementations
     */
    fundContract: async (
      params: ContractFundingParams
    ): Promise<ContractFundingResult> => {
      throw new Error('fundContract must be implemented by provider-specific version (Farcaster/Web3Auth)');
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
    
    // Web3Auth uses the base approveUSDC method (via signContractTransaction + chainservice)
    // No override needed - the base method handles the conversion correctly
    
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

        // For USDC approval, we need the raw microUSDC amount (not converted to USDC)
        // 1000 microUSDC = 1000 raw units in the USDC contract (which has 6 decimals)
        const { ethers } = await import('ethers');
        let amountWei: bigint;
        
        if (currency === 'microUSDC' || !currency) {
          // FIXED: microUSDC amount directly = wei units in USDC contract
          // 1000 microUSDC = 1000 wei = 0.001 USDC (since USDC has 6 decimals)
          amountWei = BigInt(amount);
        } else if (currency === 'USDC') {
          // Convert USDC to wei (multiply by 10^6 for 6 decimals)
          amountWei = ethers.parseUnits(amount.toString(), 6);
        } else {
          // Fallback: assume microUSDC
          amountWei = BigInt(amount);
        }
        
        // Create the transaction request  
        console.log('🔧 Farcaster: Building approval transaction with exact values:', {
          spender: contractAddress,
          amountWei: amountWei.toString(),
          amountWeiHex: '0x' + amountWei.toString(16),
          amountWeiType: typeof amountWei,
          amountWeiIsBigInt: typeof amountWei === 'bigint'
        });
        
        const txRequest = {
          from: userAddress,
          to: config.usdcContractAddress,
          data: new ethers.Interface([
            'function approve(address spender, uint256 amount)'
          ]).encodeFunctionData('approve', [contractAddress, amountWei]),
          value: '0x0',
        };
        
        // Double-check the encoded transaction data
        const approveInterface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        try {
          const decodedApproval = approveInterface.decodeFunctionData('approve', txRequest.data);
          console.log('🔧 Farcaster: Decoded approval transaction:', {
            spender: decodedApproval[0],
            amountFromData: decodedApproval[1].toString(),
            amountFromDataHex: '0x' + decodedApproval[1].toString(16),
            matchesOurAmount: decodedApproval[1].toString() === amountWei.toString()
          });
        } catch (error) {
          console.log('🔧 Farcaster: Could not decode approval data:', error);
        }
        
        console.log('🔧 Farcaster: Approval transaction data:', {
          to: txRequest.to,
          data: txRequest.data,
          dataLength: txRequest.data.length,
          decodedData: 'approve(' + contractAddress + ', ' + amountWei.toString() + ')'
        });

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
        
        // Check if there's already an allowance before approving
        try {
          const { ethers } = await import('ethers');
          const allowanceCheckData = new ethers.Interface([
            'function allowance(address owner, address spender) view returns (uint256)'
          ]).encodeFunctionData('allowance', [params.userAddress, contractAddress]);
          
          // Use RPC directly since Farcaster doesn't support eth_call
          const allowanceResponse = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: params.config.usdcContractAddress,
                data: allowanceCheckData
              }, 'latest'],
              id: 1
            })
          }).then(r => r.json());
          
          if (allowanceResponse.result) {
            const existingAllowance = BigInt(allowanceResponse.result);
            console.log('🔧 Farcaster: Existing USDC allowance before approval:', {
              allowanceHex: allowanceResponse.result,
              allowanceWei: existingAllowance.toString(),
              allowanceUSDC: ethers.formatUnits(existingAllowance, 6) + ' USDC'
            });
          }
        } catch (error) {
          console.log('🔧 Farcaster: Could not check existing allowance:', error);
        }
        
        // Check wallet client availability
        if (!walletClient || !walletClient.transport || !walletClient.transport.request) {
          throw new Error(`Farcaster wallet client not available: transport=${!!walletClient?.transport}, request=${!!walletClient?.transport?.request}`);
        }
        
        // For USDC approval, we need the raw microUSDC amount (not converted to USDC)
        // 1000 microUSDC = 1000 raw units in the USDC contract (which has 6 decimals)
        const { ethers } = await import('ethers');
        let amountWei: bigint;
        
        const currency = params.contract.currency || 'microUSDC';
        if (currency === 'microUSDC') {
          // FIXED: If currency is already microUSDC, the amount is already in microUSDC units
          // Don't double-convert: 1000 microUSDC should approve 1000 wei, not 1000000000 wei
          amountWei = BigInt(params.contract.amount);
        } else if (currency === 'USDC') {
          // Convert USDC to smallest units (multiply by 1,000,000)
          amountWei = ethers.parseUnits(params.contract.amount.toString(), 6);
        } else {
          // Fallback: assume microUSDC
          amountWei = BigInt(params.contract.amount);
        }
        
        console.log('🔧 Farcaster: USDC Approval amounts:', {
          contractAmount: params.contract.amount,
          contractCurrency: currency,
          amountWeiHex: '0x' + amountWei.toString(16),
          amountWeiDecimal: amountWei.toString(),
          readableUSDC: ethers.formatUnits(amountWei, 6) + ' USDC',
          approvingTo: contractAddress,
          note: 'FIXED: Now using same microUSDC conversion as contract creation'
        });
        
        console.log('🔧 Farcaster: WalletClient state before eth_sendTransaction:', {
          hasWalletClient: !!walletClient,
          hasTransport: !!walletClient?.transport,
          hasRequest: !!walletClient?.transport?.request,
          transportType: walletClient?.transport?.type,
          chainId: walletClient?.chain?.id,
          chainName: walletClient?.chain?.name
        });
        
        // Estimate gas for USDC approval
        const approvalTxRequest: {
          from: string;
          to: string;
          data: string;
          value: string;
          gas?: string;
          gasPrice?: string;
        } = {
          from: params.userAddress,
          to: params.config.usdcContractAddress,
          data: new ethers.Interface([
            'function approve(address spender, uint256 amount)'
          ]).encodeFunctionData('approve', [contractAddress, amountWei]),
          value: '0x0',
        };

        try {
          // Try gas estimation, but handle Farcaster provider limitations
          let gasEstimate, gasPrice;
          
          try {
            gasEstimate = await walletClient.transport.request({
              method: 'eth_estimateGas',
              params: [approvalTxRequest],
            });
          } catch (estimateError: any) {
            if (estimateError.code === 4200) {
              // Farcaster doesn't support eth_estimateGas, use typical USDC approval gas
              gasEstimate = '0x11170'; // 70,000 gas (conservative estimate for USDC approval)
              console.log('🔧 Farcaster: Using fallback gas estimate for USDC approval:', gasEstimate);
            } else {
              throw estimateError;
            }
          }
          
          try {
            gasPrice = await walletClient.transport.request({
              method: 'eth_gasPrice',
              params: [],
            });
          } catch (priceError: any) {
            if (priceError.code === 4200) {
              // Farcaster doesn't support eth_gasPrice, use current Base network typical price
              gasPrice = '0x30D40'; // 0.0002 Gwei (200,000 wei - current Base network price)
              console.log('🔧 Farcaster: Using fallback gas price for Base network:', gasPrice);
            } else {
              throw priceError;
            }
          }
          
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
            totalGasCostUSD: `~$${(parseFloat(totalGasCostEth) * 2500).toFixed(4)}`,
            note: gasEstimate === '0x11170' || gasPrice === '0x5F5E100' ? 'Using fallback estimates due to Farcaster provider limitations' : 'Real-time estimates'
          });
          
        } catch (gasError) {
          console.error('🔧 Farcaster: USDC approval gas estimation failed:', gasError);
          // Provide manual estimates for user awareness
          console.log('🔧 Farcaster: Manual gas estimate for USDC approval - ~70,000 gas units at ~0.0002 Gwei = ~0.000000014 ETH (~$0.000035)');
        }

        // Get explicit gas parameters for USDC approval
        let gasParams = {};
        try {
          const rpcGasEstimate = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_estimateGas',
              params: [approvalTxRequest],
              id: 1
            })
          }).then(r => r.json());
          
          const rpcGasPrice = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_gasPrice',
              params: [],
              id: 2
            })
          }).then(r => r.json());
          
          if (rpcGasEstimate.result && rpcGasPrice.result) {
            const gasEstimate = parseInt(rpcGasEstimate.result, 16);
            const gasWithBuffer = Math.floor(gasEstimate * 1.2);
            
            gasParams = {
              gas: BigInt(gasWithBuffer),
              gasPrice: BigInt(rpcGasPrice.result)
            };
            
            const totalCost = gasWithBuffer * parseInt(rpcGasPrice.result, 16);
            const totalCostEth = ethers.formatEther(totalCost.toString());
            
            console.log('🔧 Farcaster: Using explicit gas for USDC approval:', {
              gasEstimate: rpcGasEstimate.result,
              gasWithBuffer: gasWithBuffer.toLocaleString(),
              gasPrice: rpcGasPrice.result,
              gasPriceGwei: ethers.formatUnits(rpcGasPrice.result, 'gwei'),
              totalCostEth: totalCostEth,
              totalCostUSD: `~$${(parseFloat(totalCostEth) * 2500).toFixed(6)}`
            });
          }
        } catch (rpcError) {
          console.error('🔧 Farcaster: RPC gas estimation for approval failed:', rpcError);
        }

        let approvalTxHash: string;
        try {
          // Use walletClient.sendTransaction method with explicit gas
          console.log('🔧 Farcaster: Using walletClient.sendTransaction method with explicit gas params');
          approvalTxHash = await walletClient.sendTransaction({
            to: params.config.usdcContractAddress,
            data: new ethers.Interface([
              'function approve(address spender, uint256 amount)'
            ]).encodeFunctionData('approve', [contractAddress, amountWei]),
            value: BigInt(0),
            account: walletClient.account,
            chain: walletClient.chain,
            ...gasParams // Add explicit gas parameters
          });
          console.log('🔧 Farcaster: sendTransaction response:', approvalTxHash);
        } catch (txError) {
          console.error('🔧 Farcaster: USDC approval failed:', txError);
          throw txError;
        }
        
        console.log('🔧 Farcaster: Step 2 ✅ - USDC approved via eth_sendTransaction, tx:', approvalTxHash);
        
        // Verify the approval actually worked
        console.log('🔧 Farcaster: Verifying approval was successful...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for tx to be mined
        
        try {
          const { ethers } = await import('ethers');
          const allowanceCheckData = new ethers.Interface([
            'function allowance(address owner, address spender) view returns (uint256)'
          ]).encodeFunctionData('allowance', [params.userAddress, contractAddress]);
          
          const allowanceResponse = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: params.config.usdcContractAddress,
                data: allowanceCheckData
              }, 'latest'],
              id: 1
            })
          }).then(r => r.json());
          
          if (allowanceResponse.result) {
            const newAllowance = BigInt(allowanceResponse.result);
            console.log('🔧 Farcaster: USDC allowance AFTER approval:', {
              allowanceHex: allowanceResponse.result,
              allowanceWei: newAllowance.toString(),
              allowanceUSDC: ethers.formatUnits(newAllowance, 6) + ' USDC',
              expectedWei: amountWei.toString(),
              matches: newAllowance === amountWei
            });
            
            if (newAllowance === BigInt(0)) {
              console.error('🔧 Farcaster: WARNING - Approval transaction succeeded but allowance is still 0!');
            } else if (newAllowance !== amountWei) {
              console.error('🔧 Farcaster: WARNING - Approval amount mismatch!', {
                approved: newAllowance.toString(),
                expected: amountWei.toString()
              });
            }
          }
        } catch (error) {
          console.log('🔧 Farcaster: Could not verify approval:', error);
        }
        
        params.onProgress?.('Step 3 of 3: Depositing funds to escrow...');

        // Add longer delay before deposit to allow approval to be processed
        console.log('🔧 Farcaster: Waiting 5s before deposit to allow approval processing...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Deposit funds with eth_sendTransaction
        console.log('🔧 Farcaster: Step 3 - Depositing funds via eth_sendTransaction');
        
        // Check the actual allowance AND contract's expected amount before deposit
        console.log('🔧 Farcaster: Checking USDC allowance and contract amount before deposit...');
        
        // Use RPC directly to check contract state and expected amount
        try {
          console.log('🔧 Farcaster: Checking contract state via RPC...');
          
          // Check if contract is initialized by calling a simpler function first
          const stateResponse = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: contractAddress,
                data: '0x5aa6e675' // _state() function selector
              }, 'latest'],
              id: 1
            })
          }).then(r => r.json());
          
          console.log('🔧 Farcaster: Contract _state response:', stateResponse);
          
          // Try to get the AMOUNT field
          const contractAmountResponse = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: contractAddress,
                data: '0xa2fb1175' // AMOUNT() function selector
              }, 'latest'],
              id: 2
            })
          }).then(r => r.json());
          
          console.log('🔧 Farcaster: Contract AMOUNT RPC response:', contractAmountResponse);
          
          if (contractAmountResponse.result) {
            const contractExpectedAmount = BigInt(contractAmountResponse.result);
            console.log('🔧 Farcaster: Contract AMOUNT field:', {
              amountHex: contractAmountResponse.result,
              amountWei: contractExpectedAmount.toString(),
              amountUSDC: ethers.formatUnits(contractExpectedAmount, 6) + ' USDC',
              ourApproval: '1000',
              needsMoreApproval: contractExpectedAmount > BigInt(1000),
              shortfall: contractExpectedAmount > BigInt(1000) ? (contractExpectedAmount - BigInt(1000)).toString() : '0'
            });
            
            if (contractExpectedAmount > BigInt(1000)) {
              console.error('🔧 Farcaster: *** ROOT CAUSE FOUND ***');
              console.error('🔧 Farcaster: CONTRACT EXPECTS MORE THAN WE APPROVED!', {
                contractExpects: contractExpectedAmount.toString(),
                weApproved: '1000',
                shortfall: (contractExpectedAmount - BigInt(1000)).toString(),
                needToApprove: contractExpectedAmount.toString()
              });
            }
          } else if (contractAmountResponse.error) {
            console.error('🔧 Farcaster: Contract AMOUNT call error:', contractAmountResponse.error);
            console.log('🔧 Farcaster: This suggests the contract might not be fully initialized yet');
            
            // If AMOUNT() reverts, the contract might expect a different amount than 1000
            // Let's check what the chain service actually sent when creating the contract
            console.log('🔧 Farcaster: Chain service sent amount:', params.contract.amount, 'microUSDC');
            console.log('🔧 Farcaster: This might explain why approval of 1000 is insufficient');
          }
        } catch (error) {
          console.error('🔧 Farcaster: Could not check contract state via RPC:', error);
        }
        
        // Original Farcaster check (will fail but keeping for consistency)
        try {
          // Check allowance
          const allowanceData = new ethers.Interface([
            'function allowance(address owner, address spender) view returns (uint256)'
          ]).encodeFunctionData('allowance', [params.userAddress, contractAddress]);
          
          const allowanceResult = await walletClient.transport.request({
            method: 'eth_call',
            params: [{
              to: params.config.usdcContractAddress,
              data: allowanceData
            }, 'latest'],
          });
          
          const allowanceWei = BigInt(allowanceResult);
          
          // Check contract's AMOUNT variable
          const amountData = new ethers.Interface([
            'function AMOUNT() view returns (uint256)'
          ]).encodeFunctionData('AMOUNT', []);
          
          const amountResult = await walletClient.transport.request({
            method: 'eth_call',
            params: [{
              to: contractAddress,
              data: amountData
            }, 'latest'],
          });
          
          const contractAmountWei = BigInt(amountResult);
          
          console.log('🔧 Farcaster: Pre-deposit check:', {
            allowanceHex: allowanceResult,
            allowanceWei: allowanceWei.toString(),
            allowanceUSDC: ethers.formatUnits(allowanceWei, 6) + ' USDC',
            contractAmountHex: amountResult,
            contractAmountWei: contractAmountWei.toString(),
            contractAmountUSDC: ethers.formatUnits(contractAmountWei, 6) + ' USDC',
            mismatch: allowanceWei !== contractAmountWei,
            owner: params.userAddress,
            spender: contractAddress
          });
        } catch (error) {
          console.log('🔧 Farcaster: Could not check allowance/amount:', error);
        }
        
        // Create the deposit transaction request
        const depositTxRequest: {
          from: string;
          to: string;
          data: string;
          value: string;
          gas?: string;
          gasPrice?: string;
        } = {
          from: params.userAddress,
          to: contractAddress,
          data: new ethers.Interface([
            'function depositFunds()'
          ]).encodeFunctionData('depositFunds', []),
          value: '0x0',
        };

        // Estimate gas for the deposit transaction
        try {
          let gasEstimate, gasPrice, userBalance;
          
          // Try gas estimation with fallbacks for Farcaster provider
          try {
            gasEstimate = await walletClient.transport.request({
              method: 'eth_estimateGas',
              params: [depositTxRequest],
            });
          } catch (estimateError: any) {
            if (estimateError.code === 4200) {
              // Farcaster doesn't support eth_estimateGas, use typical deposit gas
              gasEstimate = '0x15F90'; // 90,000 gas (conservative estimate for contract deposit)
              console.log('🔧 Farcaster: Using fallback gas estimate for deposit:', gasEstimate);
            } else {
              throw estimateError;
            }
          }
          
          try {
            gasPrice = await walletClient.transport.request({
              method: 'eth_gasPrice',
              params: [],
            });
          } catch (priceError: any) {
            if (priceError.code === 4200) {
              // Farcaster doesn't support eth_gasPrice, use current Base network typical price  
              gasPrice = '0x30D40'; // 0.0002 Gwei (200,000 wei - current Base network price)
              console.log('🔧 Farcaster: Using fallback gas price for deposit:', gasPrice);
            } else {
              throw priceError;
            }
          }
          
          try {
            userBalance = await walletClient.transport.request({
              method: 'eth_getBalance',
              params: [params.userAddress, 'latest'],
            });
          } catch (balanceError: any) {
            if (balanceError.code === 4200) {
              // Farcaster doesn't support eth_getBalance, skip balance check
              console.log('🔧 Farcaster: Cannot check user balance - provider limitation');
              userBalance = null;
            } else {
              throw balanceError;
            }
          }
          
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
            totalGasCostUSD: `~$${(parseFloat(totalGasCostEth) * 2500).toFixed(4)}`,
            note: gasEstimate === '0x15F90' || gasPrice === '0x5F5E100' ? 'Using fallback estimates due to Farcaster provider limitations' : 'Real-time estimates'
          });
          
          // Check user's balance if available
          if (userBalance !== null) {
            const userBalanceDecimal = parseInt(userBalance, 16);
            const userBalanceEth = ethers.formatEther(userBalanceDecimal.toString());
            
            console.log('🔧 Farcaster: User balance check:', {
              balanceWei: userBalance,
              balanceEth: userBalanceEth,
              balanceUSD: `~$${(parseFloat(userBalanceEth) * 2500).toFixed(4)}`,
              hasEnoughGas: userBalanceDecimal > totalGasCostWei,
              shortfallWei: userBalanceDecimal > totalGasCostWei ? 0 : (totalGasCostWei - userBalanceDecimal).toString(),
              shortfallEth: userBalanceDecimal > totalGasCostWei ? 0 : ethers.formatEther((totalGasCostWei - userBalanceDecimal).toString()),
              recommendation: userBalanceDecimal <= totalGasCostWei ? `Need ${ethers.formatEther((totalGasCostWei - userBalanceDecimal).toString())} more ETH` : 'Sufficient balance'
            });
          } else {
            console.log('🔧 Farcaster: Manual recommendation - You should have at least 0.001 ETH for Base network transactions. Current estimate needs:', totalGasCostEth, 'ETH');
          }
          
        } catch (gasError) {
          console.error('🔧 Farcaster: Gas estimation failed:', gasError);
          // Provide manual estimates for user awareness
          console.log('🔧 Farcaster: Manual gas estimate for deposit - ~90,000 gas units at ~0.0002 Gwei = ~0.000000018 ETH (~$0.000045)');
          console.log('🔧 Farcaster: Recommendation - With current ultra-low Base gas prices, 0.0005 ETH should be more than 25,000× sufficient!');
        }

        // Add explicit gas parameters to override Farcaster wallet's estimates
        let finalDepositTxRequest = { ...depositTxRequest };
        
        try {
          // Make direct RPC calls for accurate estimates
          console.log('🔧 Farcaster: Making RPC eth_estimateGas call for deposit:', {
            rpcUrl: params.config.rpcUrl,
            txRequest: depositTxRequest
          });
          
          const rpcGasEstimate = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_estimateGas',
              params: [depositTxRequest],
              id: 1
            })
          }).then(r => r.json());
          
          console.log('🔧 Farcaster: RPC eth_estimateGas response:', rpcGasEstimate);
          
          const rpcGasPrice = await fetch(params.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_gasPrice',
              params: [],
              id: 2
            })
          }).then(r => r.json());
          
          if (rpcGasEstimate.result && rpcGasPrice.result) {
            // Add 20% buffer to gas estimate for safety
            const gasEstimate = parseInt(rpcGasEstimate.result, 16);
            const gasWithBuffer = Math.floor(gasEstimate * 1.2);
            
            finalDepositTxRequest.gas = `0x${gasWithBuffer.toString(16)}`;
            finalDepositTxRequest.gasPrice = rpcGasPrice.result;
            
            const totalCost = gasWithBuffer * parseInt(rpcGasPrice.result, 16);
            const totalCostEth = ethers.formatEther(totalCost.toString());
            
            console.log('🔧 Farcaster: Using explicit gas parameters from RPC:', {
              gasEstimate: rpcGasEstimate.result,
              gasEstimateDecimal: gasEstimate.toLocaleString(),
              gasWithBuffer: `0x${gasWithBuffer.toString(16)}`,
              gasWithBufferDecimal: gasWithBuffer.toLocaleString(),
              gasPrice: rpcGasPrice.result,
              gasPriceGwei: ethers.formatUnits(rpcGasPrice.result, 'gwei'),
              totalCostEth: totalCostEth,
              totalCostUSD: `~$${(parseFloat(totalCostEth) * 2500).toFixed(6)}`
            });
          }
        } catch (rpcError) {
          console.error('🔧 Farcaster: RPC gas estimation failed, using wallet defaults:', rpcError);
        }

        console.log('🔧 Farcaster: Final deposit transaction request:', finalDepositTxRequest);
        
        // Capture the real error before Farcaster's UI masks it
        let depositTxHash;
        try {
          console.log('🔧 Farcaster: About to call eth_sendTransaction for deposit...');
          
          depositTxHash = await walletClient.transport.request({
            method: 'eth_sendTransaction',
            params: [finalDepositTxRequest],
          });
          
          console.log('🔧 Farcaster: Step 3 ✅ - Funds deposited, tx:', depositTxHash);
        } catch (depositError: any) {
          console.error('🔧 Farcaster: RAW DEPOSIT ERROR (before UI processing):', depositError);
          console.error('🔧 Farcaster: Detailed error analysis:', {
            name: depositError?.name,
            message: depositError?.message,
            code: depositError?.code,
            details: depositError?.details,
            data: depositError?.data,
            stack: depositError?.stack?.substring(0, 200), // First 200 chars
            originalError: depositError?.cause || depositError?.reason,
            errorKeys: Object.keys(depositError || {}),
            errorString: depositError?.toString()
          });
          
          // Try to extract revert reason from error data
          if (depositError?.data && typeof depositError.data === 'string') {
            try {
              const errorData = depositError.data;
              console.error('🔧 Farcaster: Raw error data (might contain revert):', errorData);
              
              // Try to decode if it looks like hex-encoded revert reason
              if (errorData.startsWith('0x')) {
                try {
                  const decoded = ethers.toUtf8String(errorData);
                  console.error('🔧 Farcaster: Decoded error data:', decoded);
                } catch (decodeError) {
                  console.log('🔧 Farcaster: Could not decode error data as UTF-8');
                }
              }
            } catch (error) {
              console.log('🔧 Farcaster: Could not process error data');
            }
          }
          
          // Look for nested error information
          if (depositError?.cause) {
            console.error('🔧 Farcaster: Error cause:', depositError.cause);
          }
          if (depositError?.reason) {
            console.error('🔧 Farcaster: Error reason:', depositError.reason);
          }
          
          throw depositError; // Re-throw so UI still shows the error
        }
        
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