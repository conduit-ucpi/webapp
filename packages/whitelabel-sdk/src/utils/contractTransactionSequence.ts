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

import { predictEscrowAddress } from '../lib/counterfactualAddress';

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
 * Resolve the on-chain escrow address for a pending contract, deploying one only
 * if contractservice does not already have one recorded.
 *
 * Why: chainservice may successfully deploy a contract on-chain but fail to notify
 * contractservice (e.g. "already deployed" 400). In that case the chainservice
 * response carries an *orphan* address that is not linked to the pending record.
 * Routing a payment to the orphan loses the funds from the user's dashboard view.
 * Treat contractservice's stored address as the source of truth.
 */
export interface ResolveOrCreateParams {
  contractserviceId: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: number;
  expiryTimestamp: number;
  description: string;
  arbiterAddress?: string;
}

export interface ResolveOrCreateResult {
  contractAddress: string;
  alreadyExisted: boolean;
  contractCreationTxHash?: string;
}

export async function resolveOrCreateOnChainContract(
  params: ResolveOrCreateParams,
  options: {
    authenticatedFetch: (url: string, init?: RequestInit) => Promise<Response>;
    getWeb3Service: () => Promise<any>;
    onProgress?: (step: string, message: string, contractAddress?: string) => void;
  }
): Promise<ResolveOrCreateResult> {
  const { authenticatedFetch, getWeb3Service, onProgress } = options;

  // Fetch the pending contract. Optionally retry on transient server errors
  // (HTTP >= 500): immediately after the on-chain create is confirmed, the
  // contract service is still processing the chain event and recording the
  // address, and briefly returns 500. We back off and retry rather than failing
  // the whole payment. We do NOT retry 4xx (e.g. 401/404) — those are real and
  // should surface immediately.
  const fetchPending = async (retries = 0, delayMs = 750) => {
    for (let attempt = 0; ; attempt++) {
      const r = await authenticatedFetch(`/api/contracts/${params.contractserviceId}`, { method: 'GET' });
      if (r.ok) {
        return r.json();
      }
      const isTransient = r.status >= 500;
      if (isTransient && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw new Error('Failed to load pending contract while resolving on-chain address');
    }
  };

  const existing = await fetchPending();
  if (existing?.contractAddress) {
    onProgress?.('contract_existing', `Using existing escrow contract: ${existing.contractAddress}`, existing.contractAddress);
    return { contractAddress: existing.contractAddress, alreadyExisted: true };
  }

  onProgress?.('contract_creation', 'Creating secure escrow contract...');

  const { arbiterAddress, ...paramsWithoutArbiter } = params;
  const createBody = {
    ...paramsWithoutArbiter,
    ...(arbiterAddress ? { arbiter: arbiterAddress } : {})
  };

  const createResponse = await authenticatedFetch('/api/chain/create-contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody)
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new Error(errorData.error || 'Contract creation failed');
  }

  const createData = await createResponse.json();
  const candidateAddress: string | undefined = createData.contractAddress;
  const txHash: string | undefined = createData.transactionHash;

  if (txHash) {
    onProgress?.('contract_confirmation', 'Waiting for contract creation to be confirmed...');
    const web3Service = await getWeb3Service();
    const receipt = await web3Service.waitForTransaction(txHash, 120000, params.contractserviceId);
    if (!receipt) {
      throw new Error('Contract creation timed out or failed');
    }
  }

  // Prefer contractservice's stored address as the source of truth (defends
  // against the chainservice returning an orphan address when its post-create
  // notification is rejected). If contractservice hasn't recorded the address
  // yet (notification timing, eventual consistency), fall back to the address
  // chainservice just returned. The pre-create GET above is the real defence
  // against double-deploys; this is only for catching mismatches.
  //
  // Retry transient 5xx here: this GET runs immediately after the on-chain
  // create is confirmed, while contractservice is still processing the chain
  // event — it briefly 500s. Without retry the whole payment fails with
  // "Failed to load pending contract" even though the create succeeded.
  //
  // If the re-fetch still fails after retries, do NOT fail the payment: the
  // create already succeeded on-chain and chainservice returned a usable
  // candidateAddress. The re-fetch is only to prefer contractservice's stored
  // address when available; falling back to candidateAddress is correct.
  let storedAddress: string | undefined;
  try {
    const refreshed = await fetchPending(4, 750);
    storedAddress = refreshed?.contractAddress;
  } catch (refetchError) {
    console.warn(
      '🔧 resolveOrCreate: post-create contract re-fetch failed after retries; ' +
        'falling back to the address chainservice returned.',
      refetchError instanceof Error ? refetchError.message : refetchError
    );
  }

  if (storedAddress && candidateAddress && storedAddress.toLowerCase() !== candidateAddress.toLowerCase()) {
    console.warn(
      '🔧 resolveOrCreate: chainservice returned',
      candidateAddress,
      'but contractservice stores',
      storedAddress,
      '- using contractservice value (chainservice address is likely an orphan)'
    );
  }

  const finalAddress = storedAddress ?? candidateAddress;

  if (!finalAddress) {
    throw new Error('Contract creation succeeded but no address was returned');
  }

  onProgress?.('contract_created', `Contract created: ${finalAddress}`, finalAddress);

  return {
    contractAddress: finalAddress,
    alreadyExisted: false,
    contractCreationTxHash: txHash
  };
}

/**
 * Work out where this escrow will live, and make sure somebody else knows.
 *
 * The address is a pure function of the escrow's terms (see counterfactualAddress), so this
 * costs no RPC call, no transaction and no waiting — which is the whole point. What it
 * replaces was: deploy the escrow, wait up to two minutes for the receipt, re-read
 * contractservice through a retry loop because it 500s while it indexes the chain event, then
 * reconcile the address chainservice returned against the one contractservice stored in case
 * the notification between them had failed. All of that existed only because an address could
 * not be known until a deployment had produced one.
 *
 * ⚠️ RECORDING IT WITH CONTRACTSERVICE IS NOT BOOKKEEPING, AND IT MUST HAPPEN BEFORE THE
 *    TRANSFER. Sending tokens to an address with no code deployed at it triggers nothing at
 *    all: an ERC20 transfer only moves a balance inside the token contract. If this browser
 *    dies between paying and deploying, the sweep in contractservice is what finishes the job
 *    — and it can only do that for an address it was told about. Record after transferring
 *    and a crash in between leaves money somewhere nobody is looking.
 *
 * The write is idempotent, so a retry here is safe.
 */
export async function reserveCounterfactualAddress(
  params: ResolveOrCreateParams,
  options: {
    authenticatedFetch: (url: string, init?: RequestInit) => Promise<Response>;
    factoryAddress: string;
    implementationAddress: string;
    /** The arbiter chainservice will create the escrow with when none is supplied. */
    defaultArbiterAddress: string;
    onProgress?: (step: string, message: string, contractAddress?: string) => void;
  }
): Promise<ResolveOrCreateResult> {
  const { authenticatedFetch, factoryAddress, implementationAddress, defaultArbiterAddress, onProgress } =
    options;

  // The arbiter is one of the terms the address is derived from, so guessing it is not an
  // option: a wrong value here yields an address the factory will never deploy to.
  const arbiter = params.arbiterAddress || defaultArbiterAddress;

  if (!factoryAddress || !implementationAddress || !arbiter) {
    throw new Error(
      'Cannot compute the escrow address without the factory, implementation and arbiter addresses'
    );
  }

  const contractAddress = predictEscrowAddress(factoryAddress, implementationAddress, {
    tokenAddress: params.tokenAddress,
    buyer: params.buyer,
    seller: params.seller,
    amount: params.amount,
    expiryTimestamp: params.expiryTimestamp,
    arbiter,
    contractserviceId: params.contractserviceId
  });

  onProgress?.('address_reserved', `Escrow address: ${contractAddress}`, contractAddress);

  const response = await authenticatedFetch(`/api/contracts/${params.contractserviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainAddress: contractAddress,
      buyerAddress: params.buyer,
      factoryAddress,
      tokenAddress: params.tokenAddress
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Carry the status even when there is no body. A refusal here stops the payment before
    // anything is signed, so "it did not work" is not a useful thing to be left holding —
    // 403 and 400 mean very different things to whoever has to fix it.
    const detail = errorData.error || `contractservice returned ${response.status}`;
    throw new Error(
      `Could not record the escrow address before payment (${detail}). Refusing to send funds ` +
        'to an address nothing knows about.'
    );
  }

  return { contractAddress, alreadyExisted: false };
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

  // Step 1: Resolve the on-chain escrow address. Skips deploy if one already
  // exists for this pending contract; trusts contractservice's stored address as
  // the source of truth so we never approve/deposit against a chainservice
  // orphan address.
  const { contractAddress, contractCreationTxHash } = await resolveOrCreateOnChainContract(
    params,
    { authenticatedFetch, getWeb3Service, onProgress }
  );

  if (contractCreationTxHash) {
    // Brief settle so the buyer's nonce is up to date before signing the next tx
    await new Promise(resolve => setTimeout(resolve, 2000));
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

/**
 * Direct payment sequence for wallet-connected buyers
 *
 * This is a simplified flow that:
 * 1. Creates the contract on the blockchain (via chainservice)
 * 2. Transfers tokens directly to the contract address (ERC20 transfer, no approve step)
 * 3. Calls check-and-activate to verify the balance and activate the contract
 *
 * This replaces the approve + depositFunds pattern with a simple ERC20 push transfer.
 */

interface DirectPaymentParams {
  contractserviceId: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: number; // microUSDC
  expiryTimestamp: number;
  description: string;
  arbiterAddress?: string; // Optional custom arbiter; omitted from wire when falsy
}

interface DirectPaymentResult {
  contractAddress: string;
  contractCreationTxHash?: string;
  transferTxHash: string;
}

interface DirectPaymentOptions {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  transferToContract: (tokenAddress: string, contractAddress: string, amount: string) => Promise<string>;
  getWeb3Service: () => Promise<any>;
  onProgress?: (step: string, message: string, contractAddress?: string) => void;
  /**
   * The factory, implementation and default arbiter the escrow address is derived from — all
   * three come from /api/config, so the browser computes exactly the address chainservice
   * will deploy to.
   */
  factoryAddress: string;
  implementationAddress: string;
  defaultArbiterAddress: string;
  /**
   * The escrow address, if the page already derived and recorded it while idle.
   *
   * Omit it and the sequence does that work itself. Supplying it is what removes the two round
   * trips between the user pressing Pay and their wallet opening.
   */
  preparedAddress?: string;
}

export async function executeDirectPaymentSequence(
  params: DirectPaymentParams,
  options: DirectPaymentOptions
): Promise<DirectPaymentResult> {
  const {
    authenticatedFetch,
    transferToContract,
    getWeb3Service,
    onProgress,
    factoryAddress,
    implementationAddress,
    defaultArbiterAddress
  } = options;

  // Where the escrow will live, and contractservice told about it before anything is sent.
  //
  // ⚠️ ALWAYS DERIVED HERE, NEVER TAKEN ON TRUST. Deriving is a pure function of the terms
  //    below and costs nothing, so there is no reason to skip it — and skipping it was a real
  //    bug: `preparedAddress` comes from the page, which seeds it from the contract's RECORDED
  //    chainAddress. That was derived from whatever the terms were when it was recorded, which
  //    is not necessarily what is being paid now. A different token selected, or a record from
  //    an earlier session, and the transfer goes to one address while the deploy targets
  //    another — the money lands somewhere real and the activation reports "address holds 0".
  //
  //    So what `preparedAddress` saves is the RECORDING round trip, not the derivation. It is
  //    honoured only when it matches; when it does not, the full reservation runs so that the
  //    address actually being paid is the one on file.
  const arbiter = params.arbiterAddress || defaultArbiterAddress;
  const derivedAddress = predictEscrowAddress(factoryAddress, implementationAddress, {
    tokenAddress: params.tokenAddress,
    buyer: params.buyer,
    seller: params.seller,
    amount: params.amount,
    expiryTimestamp: params.expiryTimestamp,
    arbiter,
    contractserviceId: params.contractserviceId
  });

  const alreadyRecorded =
    !!options.preparedAddress &&
    options.preparedAddress.toLowerCase() === derivedAddress.toLowerCase();

  if (!alreadyRecorded && options.preparedAddress) {
    console.warn(
      `🔧 DirectPayment: the prepared address ${options.preparedAddress} is not what these ` +
        `terms derive to (${derivedAddress}) — recording the derived one instead.`
    );
  }

  const contractAddress = alreadyRecorded
    ? derivedAddress
    : (
        await reserveCounterfactualAddress(params, {
          authenticatedFetch,
          factoryAddress,
          implementationAddress,
          defaultArbiterAddress,
          onProgress
        })
      ).contractAddress;

  if (alreadyRecorded) {
    // The step happened, just earlier. Marking it keeps the checklist honest rather than
    // leaving a box unticked for work that is already complete.
    onProgress?.('address_reserved', `Escrow address: ${contractAddress}`, contractAddress);
  }

  // Step 2: the buyer's single signature. Nothing is deployed at this address yet, and that
  // is fine - an ERC20 transfer is a ledger entry inside the TOKEN contract, which does not
  // care whether the destination holds any code.
  onProgress?.('transfer', 'Sending funds to the escrow address...');
  const transferTxHash = await transferToContract(
    params.tokenAddress,
    contractAddress,
    params.amount.toString()
  );

  if (transferTxHash) {
    onProgress?.('transfer_confirmation', 'Waiting for your transfer to confirm...');
    const web3Service = await getWeb3Service();
    const receipt = await web3Service.waitForTransaction(transferTxHash, 120000, params.contractserviceId);
    if (!receipt) {
      // Not fatal. The money may well have landed, and the address is already recorded, so
      // the sweep can still deploy onto it. Timing out is worth saying; calling it a failure
      // would not be true.
      console.warn('🔧 DirectPayment: transfer confirmation timed out - may still be pending');
    }
  }

  // Step 3: create the escrow on top of those funds and activate it, in one transaction.
  //
  // This is the step that makes the money reachable. Until it lands, the tokens sit at an
  // address with no code and nothing can move them. If it fails, or this browser dies first,
  // the scheduled sweep finishes the job instead - which is exactly why the address was
  // recorded in step 1 rather than here.
  onProgress?.('activation', 'Creating the escrow around your funds...');
  const activateResponse = await authenticatedFetch('/api/chain/deploy-and-activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenAddress: params.tokenAddress,
      buyer: params.buyer,
      seller: params.seller,
      amount: params.amount.toString(),
      expiryTimestamp: params.expiryTimestamp,
      description: params.description,
      ...(params.arbiterAddress ? { arbiter: params.arbiterAddress } : {}),
      contractserviceId: params.contractserviceId,
      factoryAddress,
      // ⚠️ THE TRANSFER HASH, SO CHAINSERVICE WAITS FOR IT. This browser saw the transfer
      //    confirm through one RPC node; chainservice reads the balance through another, and
      //    for a few seconds after a block the two can disagree. Without the hash chainservice
      //    reads "holds 0 of the amount required" and refuses, and the person sees a failure
      //    over money that had already landed (seen on cherry 2026-09-18). Given the hash it
      //    waits for the receipt and retries the read before deciding.
      ...(transferTxHash ? { fundingTxHash: transferTxHash } : {})
    })
  });

  const activateData = await activateResponse.json().catch(() => ({}));

  if (!activateResponse.ok || !activateData.success) {
    throw new Error(
      activateData.error ||
        'The transfer went through but the escrow could not be created on top of it. The funds ' +
          'are at the escrow address and will be picked up automatically.'
    );
  }

  onProgress?.('complete', 'Payment completed successfully');

  return {
    contractAddress,
    transferTxHash
  };
}
