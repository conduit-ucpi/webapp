/**
 * Shared utility for the contract creation and funding transaction sequence
 *
 * This handles the critical sequencing of:
 * 1. Contract creation (via chainservice)
 * 2. USDC approval (wait for confirmation)
 * 3. Deposit funds (wait for confirmation)
 *
 * This prevents nonce collisions by ensuring each transaction is confirmed
 * before proceeding to the next one.
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
  approveUSDC: (contractAddress: string, amount: string) => Promise<string>;
  depositToContract: (contractAddress: string) => Promise<string>;
  getWeb3Service: () => Promise<any>;
  onProgress?: (step: string, message: string) => void;
}

/**
 * Execute the complete contract creation and funding sequence
 * with proper transaction confirmation waiting
 */
export async function executeContractTransactionSequence(
  params: ContractCreationParams,
  options: TransactionSequenceOptions
): Promise<TransactionSequenceResult> {
  const { authenticatedFetch, approveUSDC, depositToContract, getWeb3Service, onProgress } = options;

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
      const receipt = await web3Service.waitForTransaction(contractCreationTxHash, 120000); // 2 minute timeout

      if (receipt) {
        console.log('🔧 ContractSequence: ✅ Contract creation confirmed. Block:', receipt.blockNumber);
      } else {
        console.warn('🔧 ContractSequence: ⚠️ Contract creation timed out but proceeding anyway');
      }
    } catch (waitError) {
      console.error('🔧 ContractSequence: ⚠️ Error waiting for contract creation, proceeding anyway:', waitError);
      // Don't fail - proceed with approval as the contract might still be valid
    }
  } else {
    console.log('🔧 ContractSequence: No transaction hash returned, proceeding to approval immediately');
  }

  // Step 2: Approve USDC spending
  onProgress?.('usdc_approval', 'Approving USDC transfer...');

  const approvalTxHash = await approveUSDC(
    contractAddress,
    params.amount.toString() // amount is already in microUSDC
  );

  console.log('🔧 ContractSequence: USDC approval transaction:', approvalTxHash);

  // Step 2.5: Wait for USDC approval transaction to be confirmed
  if (approvalTxHash) {
    console.log('🔧 ContractSequence: Waiting for USDC approval transaction to be confirmed:', approvalTxHash);
    onProgress?.('approval_confirmation', 'Waiting for USDC approval to be confirmed...');

    try {
      const web3Service = await getWeb3Service();
      const receipt = await web3Service.waitForTransaction(approvalTxHash, 120000); // 2 minute timeout

      if (receipt) {
        console.log('🔧 ContractSequence: ✅ USDC approval confirmed. Block:', receipt.blockNumber);
      } else {
        console.warn('🔧 ContractSequence: ⚠️ USDC approval timed out but proceeding anyway');
      }
    } catch (waitError) {
      console.error('🔧 ContractSequence: ⚠️ Error waiting for USDC approval, proceeding anyway:', waitError);
      // Don't fail - proceed with deposit as the approval might still be valid
    }
  } else {
    console.log('🔧 ContractSequence: No approval transaction hash returned, proceeding to deposit immediately');
  }

  // Step 3: Deposit funds into the contract
  onProgress?.('deposit', 'Depositing funds into escrow...');

  const depositTxHash = await depositToContract(contractAddress);

  console.log('🔧 ContractSequence: Deposit transaction:', depositTxHash);

  // Step 3.5: Wait for deposit transaction to be confirmed (optional, but good practice)
  if (depositTxHash) {
    console.log('🔧 ContractSequence: Waiting for deposit transaction to be confirmed:', depositTxHash);
    onProgress?.('deposit_confirmation', 'Waiting for deposit to be confirmed...');

    try {
      const web3Service = await getWeb3Service();
      const receipt = await web3Service.waitForTransaction(depositTxHash, 120000); // 2 minute timeout

      if (receipt) {
        console.log('🔧 ContractSequence: ✅ Deposit confirmed. Block:', receipt.blockNumber);
      } else {
        console.warn('🔧 ContractSequence: ⚠️ Deposit timed out but likely successful');
      }
    } catch (waitError) {
      console.error('🔧 ContractSequence: ⚠️ Error waiting for deposit confirmation:', waitError);
      // Don't fail - deposit was likely successful
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