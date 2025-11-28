/**
 * Shared utility for the contract creation and funding transaction sequence
 *
 * This handles the critical sequencing of:
 * 1. Contract creation (via chainservice)
 * 2. USDC approval (wait for confirmation)
 * 3. Deposit funds (wait for confirmation) + notify contractservice
 *
 * This prevents nonce collisions by ensuring each transaction is confirmed
 * before proceeding to the next one.
 *
 * Two deposit methods are supported:
 * - Direct: User signs deposit transaction, then webapp notifies contractservice (steps 3 + 4)
 * - Proxy: Chainservice deposits and notifies in one call (step 3 only)
 */

interface ContractCreationParams {
  contractserviceId: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: number; // microUSDC
  expiryTimestamp: number;
  description: string;
}

interface TransactionSequenceResult {
  contractAddress: string;
  contractCreationTxHash?: string;
  approvalTxHash: string;
  depositTxHash: string;
}

interface TransactionSequenceOptions {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  approveUSDC: (contractAddress: string, amount: string, tokenAddress?: string) => Promise<string>;
  depositToContract: (contractAddress: string) => Promise<string>;
  depositFundsAsProxy?: (contractAddress: string) => Promise<string>;
  getWeb3Service: () => Promise<any>;
  onProgress?: (step: string, message: string, contractAddress?: string) => void;
  useProxyDeposit?: boolean; // If true, use depositFundsAsProxy instead of depositToContract
}

/**
 * Execute the complete contract creation and funding sequence
 * with proper transaction confirmation waiting
 */
export async function executeContractTransactionSequence(
  params: ContractCreationParams,
  options: TransactionSequenceOptions
): Promise<TransactionSequenceResult> {
  const {
    authenticatedFetch,
    approveUSDC,
    depositToContract,
    depositFundsAsProxy,
    getWeb3Service,
    onProgress,
    useProxyDeposit = false // Default to direct deposit (old behavior)
  } = options;

  // Step 1: Create the contract on the blockchain
  onProgress?.('contract_creation', 'Creating secure escrow contract...');

  const createResponse = await authenticatedFetch('/api/chain/create-contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new Error(errorData.error || 'Contract creation failed');
  }

  const createData = await createResponse.json();
  const contractAddress = createData.contractAddress;
  const contractCreationTxHash = createData.transactionHash;

  console.log('🔧 ContractSequence: Contract creation returned:', {
    contractAddress,
    transactionHash: contractCreationTxHash
  });

  // Step 1.5: Wait for contract creation transaction to be confirmed
  if (contractCreationTxHash) {
    console.log('🔧 ContractSequence: Waiting for contract creation transaction to be confirmed:', contractCreationTxHash);
    onProgress?.('contract_confirmation', 'Waiting for contract creation to be confirmed...');

    try {
      const web3Service = await getWeb3Service();
      const receipt = await web3Service.waitForTransaction(contractCreationTxHash, 120000, params.contractserviceId); // 2 minute timeout

      if (receipt) {
        console.log('🔧 ContractSequence: ✅ Contract creation confirmed. Block:', receipt.blockNumber);

        // Notify UI that contract is created and ready
        onProgress?.('contract_created', `Your contract is: ${contractAddress}. Depending on your wallet configuration, you may be required to approve transactions.`, contractAddress);

        // Additional safety: Ensure nonce has updated after transaction confirmation
        // This prevents the next transaction from using the same nonce
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for nonce to update
        console.log('🔧 ContractSequence: ✅ Nonce update delay completed');
      } else {
        throw new Error('Contract creation timed out or failed - cannot proceed without confirmation');
      }
    } catch (waitError) {
      console.error('🔧 ContractSequence: ❌ Contract creation confirmation failed:', waitError);
      throw new Error(`Contract creation confirmation failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
    }
  } else {
    console.log('🔧 ContractSequence: No transaction hash returned, proceeding to approval immediately');
  }

  // Step 2: Approve token spending (USDC or USDT based on params.tokenAddress)
  onProgress?.('usdc_approval', 'Approving token transfer...');

  const approvalTxHash = await approveUSDC(
    contractAddress,
    params.amount.toString(), // amount is already in micro units
    params.tokenAddress // Pass the selected token address (USDC or USDT)
  );

  console.log('🔧 ContractSequence: USDC approval transaction:', approvalTxHash);

  // Step 2.5: Wait for USDC approval transaction to be confirmed
  if (approvalTxHash) {
    console.log('🔧 ContractSequence: Waiting for USDC approval transaction to be confirmed:', approvalTxHash);
    onProgress?.('approval_confirmation', 'Waiting for USDC approval to be confirmed...');

    try {
      const web3Service = await getWeb3Service();
      const receipt = await web3Service.waitForTransaction(approvalTxHash, 120000, params.contractserviceId); // 2 minute timeout

      if (receipt) {
        console.log('🔧 ContractSequence: ✅ USDC approval confirmed. Block:', receipt.blockNumber);

        // Additional safety: Ensure nonce has updated after transaction confirmation
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for nonce to update
        console.log('🔧 ContractSequence: ✅ Nonce update delay completed');
      } else {
        throw new Error('USDC approval timed out or failed - cannot proceed without confirmation');
      }
    } catch (waitError) {
      console.error('🔧 ContractSequence: ❌ USDC approval confirmation failed:', waitError);
      throw new Error(`USDC approval confirmation failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
    }
  } else {
    console.log('🔧 ContractSequence: No approval transaction hash returned, proceeding to deposit immediately');
  }

  // Step 3: Deposit funds into the contract (and notify contractservice)
  // Two methods available:
  // - Direct: User signs deposit tx, then we notify contractservice (2 separate steps)
  // - Proxy: Chainservice deposits and notifies in one call (1 combined step)

  let depositTxHash: string;

  if (useProxyDeposit) {
    // Proxy method: chainservice handles both deposit AND notification
    if (!depositFundsAsProxy) {
      throw new Error('depositFundsAsProxy function not provided but useProxyDeposit is true');
    }

    onProgress?.('deposit', 'Depositing funds into escrow via platform...');
    console.log('🔧 ContractSequence: Using proxy deposit method (chainservice handles deposit + notification)');

    depositTxHash = await depositFundsAsProxy(contractAddress);
    console.log('🔧 ContractSequence: Proxy deposit transaction:', depositTxHash);

    // Note: Notification to contractservice happens automatically in the chainservice endpoint
    console.log('🔧 ContractSequence: ✅ Deposit and notification completed via proxy');

  } else {
    // Direct method: user signs deposit, then we notify contractservice separately
    onProgress?.('deposit', 'Depositing funds into escrow...');
    console.log('🔧 ContractSequence: Using direct deposit method (user signs transaction)');

    depositTxHash = await depositToContract(contractAddress);
    console.log('🔧 ContractSequence: Deposit transaction:', depositTxHash);

    // Step 3.5: Wait for deposit transaction to be confirmed
    if (depositTxHash) {
      console.log('🔧 ContractSequence: Waiting for deposit transaction to be confirmed:', depositTxHash);
      onProgress?.('deposit_confirmation', 'Waiting for deposit to be confirmed...');

      try {
        const web3Service = await getWeb3Service();
        const receipt = await web3Service.waitForTransaction(depositTxHash, 120000, params.contractserviceId); // 2 minute timeout

        if (receipt) {
          console.log('🔧 ContractSequence: ✅ Deposit confirmed. Block:', receipt.blockNumber);
        } else {
          // Timeout - transaction may still be pending, this is acceptable
          console.warn('🔧 ContractSequence: ⚠️ Deposit confirmation timed out - transaction may still be pending');
          // Don't fail here - deposit transactions are more tolerant of confirmation delays
        }
      } catch (waitError) {
        // Transaction failed - this should cause the sequence to fail
        console.error('🔧 ContractSequence: ❌ Deposit transaction failed:', waitError);
        throw new Error(`Deposit transaction failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
      }

      // Step 4: Notify contractservice about the deposit (only for direct method)
      console.log('🔧 ContractSequence: Notifying contractservice about deposit...');

      try {
        const depositNotification = {
          contractHash: contractAddress // The on-chain contract address
        };

        const response = await authenticatedFetch('/api/contracts/deposit-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(depositNotification)
        });

        if (!response.ok) {
          console.error('Contract service deposit notification failed:', await response.text());
          // Don't throw - the blockchain transaction succeeded
        } else {
          console.log('✅ Contract service notified about deposit');
        }
      } catch (error) {
        console.error('Failed to notify contract service about deposit:', error);
        // Don't throw - the blockchain transaction succeeded
      }
    }
  }

  onProgress?.('complete', 'Transaction sequence completed successfully');

  return {
    contractAddress,
    contractCreationTxHash,
    approvalTxHash,
    depositTxHash
  };
}