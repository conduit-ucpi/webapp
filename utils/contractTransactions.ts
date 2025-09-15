import { ethers } from 'ethers';
import { ERC20_ABI, ESCROW_CONTRACT_ABI } from '@conduit-ucpi/sdk';
import { CreateContractRequest } from '@/types';
import { ensureAddressPrefix } from '@/utils/validation';

export interface TransactionSigner {
  signContractTransaction: (params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
  }) => Promise<string>;
  fundAndSendTransaction?: (txParams: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: bigint;
    gasPrice?: bigint;
  }) => Promise<string>;
  waitForTransaction?: (transactionHash: string, maxWaitTime?: number) => Promise<void>;
}

export interface AuthenticatedFetcher {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface ContractTransactionConfig {
  usdcContractAddress: string;
  serviceLink: string;
}

export interface ContractFundingParams {
  contract: {
    id: string;
    amount: number;
    currency?: string;
    sellerAddress: string;
    expiryTimestamp: number;
    description: string;
    buyerEmail?: string;
    sellerEmail?: string;
  };
  userAddress: string;
  config: ContractTransactionConfig;
  utils: {
    toMicroUSDC?: (amount: number) => number;
    toUSDCForWeb3?: (amount: number, currency?: string) => string;
    formatDateTimeWithTZ?: (timestamp: number) => string;
  };
  onStatusUpdate?: (step: string, message: string) => void;
}

export class ContractTransactionService {
  constructor(
    private signer: TransactionSigner,
    private fetcher: AuthenticatedFetcher
  ) {}

  /**
   * Creates a new escrow contract on-chain
   */
  async createContract(
    contract: ContractFundingParams['contract'],
    userAddress: string,
    config: ContractTransactionConfig,
    utils: ContractFundingParams['utils']
  ): Promise<string> {
    // FIXED: If already in microUSDC, use directly. Don't double-convert.
    // The contract.amount is already in microUSDC format from the backend
    const amountInMicroUSDC = contract.amount;
    
    const contractRequest: CreateContractRequest = {
      contractserviceId: contract.id,
      tokenAddress: ensureAddressPrefix(config.usdcContractAddress),
      buyer: ensureAddressPrefix(userAddress),
      seller: ensureAddressPrefix(contract.sellerAddress),
      amount: amountInMicroUSDC.toString(),
      expiryTimestamp: contract.expiryTimestamp,
      description: contract.description,
      serviceLink: config.serviceLink
    };

    const response = await this.fetcher.authenticatedFetch('/api/chain/create-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractRequest)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Contract creation failed');
    }

    const result = await response.json();
    console.log('🔧 ContractTransactionService: Contract creation response:', result);
    
    // Handle both possible response formats from backend
    const contractAddress = result.contractAddress || result.address || result.data;
    
    console.log(`🚨 SECURITY DEBUG - createContract response:`, {
      rawResult: result,
      extractedAddress: contractAddress,
      contractId: contract.id,
      responseFields: Object.keys(result),
      timestamp: new Date().toISOString()
    });
    
    if (!contractAddress) {
      console.error('🔧 ContractTransactionService: No address in response:', result);
      throw new Error(result.error || 'Contract creation failed - no address returned');
    }

    console.log(`🚨 SECURITY DEBUG - createContract returning:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      addressLength: contractAddress.length,
      isValidHex: contractAddress.startsWith('0x')
    });

    return contractAddress;
  }

  /**
   * Approves USDC spending using fundAndSendTransaction (direct RPC)
   */
  async approveAndSendUSDC(
    contractAddress: string,
    amount: number,
    currency: string | undefined,
    userAddress: string,
    config: ContractTransactionConfig,
    utils: ContractFundingParams['utils']
  ): Promise<string> {
    if (!this.signer.fundAndSendTransaction) {
      throw new Error('fundAndSendTransaction not supported by this signer');
    }

    // Convert to USDC format for approval (preserve precision for Web3)
    const usdcAmount = utils?.toUSDCForWeb3 
      ? utils.toUSDCForWeb3(amount, currency || 'microUSDC') 
      : amount.toString();
    
    const decimals = 6; // USDC has 6 decimals
    const amountWei = ethers.parseUnits(usdcAmount, decimals);
    
    // Create the approval transaction data
    const usdcContract = new ethers.Contract(config.usdcContractAddress, ERC20_ABI);
    const txData = usdcContract.interface.encodeFunctionData('approve', [
      ensureAddressPrefix(contractAddress), 
      amountWei
    ]);

    console.log('🔧 ContractTransactionService: Approving USDC via fundAndSendTransaction');
    
    // Use fundAndSendTransaction to handle funding and sending in one step
    const txHash = await this.signer.fundAndSendTransaction({
      to: ensureAddressPrefix(config.usdcContractAddress),
      data: txData
    });

    console.log('🔧 ContractTransactionService: USDC approval transaction sent:', txHash);
    
    // Wait for transaction confirmation before returning
    await this.waitForTransactionConfirmation(txHash, config);
    console.log('🔧 ContractTransactionService: USDC approval confirmed');

    return txHash;
  }

  /**
   * Approves USDC spending for the escrow contract
   */
  async approveUSDC(
    contractAddress: string,
    amount: number,
    currency: string | undefined,
    userAddress: string,
    config: ContractTransactionConfig,
    utils: ContractFundingParams['utils']
  ): Promise<string> {
    // Convert to USDC format for approval (preserve precision for Web3)
    const usdcAmount = utils?.toUSDCForWeb3 
      ? utils.toUSDCForWeb3(amount, currency || 'microUSDC') 
      : amount.toString();
    
    const decimals = 6; // USDC has 6 decimals
    const amountWei = ethers.parseUnits(usdcAmount, decimals);
    
    // Sign the approval transaction
    const approvalTx = await this.signer.signContractTransaction({
      contractAddress: ensureAddressPrefix(config.usdcContractAddress),
      abi: ERC20_ABI,
      functionName: 'approve',
      functionArgs: [ensureAddressPrefix(contractAddress), amountWei],
      debugLabel: 'USDC APPROVAL'
    });

    // Submit to backend
    const response = await this.fetcher.authenticatedFetch('/api/chain/approve-usdc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userWalletAddress: userAddress,
        signedTransaction: approvalTx
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'USDC approval failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'USDC approval failed');
    }

    const transactionHash = result.transactionHash;
    if (!transactionHash || transactionHash === 'approval-completed') {
      return transactionHash || 'approval-completed';
    }

    // Wait for transaction confirmation before returning
    console.log('🔧 ContractTransactionService: Waiting for USDC approval confirmation...', transactionHash);
    await this.waitForTransactionConfirmation(transactionHash, config);
    console.log('🔧 ContractTransactionService: USDC approval confirmed');

    return transactionHash;
  }

  /**
   * Wait for transaction confirmation on blockchain
   */
  private async waitForTransactionConfirmation(
    transactionHash: string, 
    config: ContractTransactionConfig,
    maxWaitTime: number = 30000 // 30 seconds
  ): Promise<void> {
    // For Web3Auth, we need to get the provider to check transaction status
    // This will be implemented by the specific signer (Web3Auth or Farcaster)
    if ('waitForTransaction' in this.signer) {
      await (this.signer as any).waitForTransaction(transactionHash, maxWaitTime);
      return;
    }

    // Fallback: Simple polling wait (for providers that don't support waitForTransaction)
    console.log('🔧 ContractTransactionService: Using fallback polling for transaction confirmation');
    
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
      
      try {
        // Try to fetch transaction status from an API if available
        const statusResponse = await this.fetcher.authenticatedFetch(`/api/chain/transaction-status/${transactionHash}`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.confirmed || status.status === 'confirmed') {
            return; // Transaction confirmed
          }
        }
      } catch (error) {
        // Continue polling if status check fails
        console.log('🔧 ContractTransactionService: Status check failed, continuing to poll...');
      }
    }
    
    console.warn('🔧 ContractTransactionService: Transaction confirmation timeout, proceeding anyway');
  }

  /**
   * Deposits funds using fundAndSendTransaction (direct RPC)
   */
  async depositAndSendFunds(params: ContractFundingParams & { contractAddress: string }): Promise<string> {
    const { contract, userAddress, contractAddress, config, utils } = params;
    
    if (!this.signer.fundAndSendTransaction) {
      throw new Error('fundAndSendTransaction not supported by this signer');
    }

    console.log(`🚨 SECURITY DEBUG - depositAndSendFunds called with:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      userAddress: userAddress,
      timestamp: new Date().toISOString()
    });
    
    // Create the deposit transaction data
    const escrowContract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI);
    const txData = escrowContract.interface.encodeFunctionData('depositFunds', []);

    console.log('🔧 ContractTransactionService: Depositing funds via fundAndSendTransaction');
    
    // Use fundAndSendTransaction to handle funding and sending in one step
    const txHash = await this.signer.fundAndSendTransaction({
      to: ensureAddressPrefix(contractAddress),
      data: txData
    });

    console.log('🔧 ContractTransactionService: Deposit transaction sent:', txHash);
    
    // Wait for transaction confirmation
    await this.waitForTransactionConfirmation(txHash, config);
    console.log('🔧 ContractTransactionService: Deposit confirmed');

    // Notify contractservice about the successful deposit
    try {
      console.log('🔧 ContractTransactionService: Notifying contractservice about deposit');
      const notificationResponse = await this.fetcher.authenticatedFetch('/api/contracts/deposit-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractHash: contractAddress
        })
      });

      if (notificationResponse.ok) {
        console.log('🔧 ContractTransactionService: Deposit notification sent successfully');
      } else {
        const errorData = await notificationResponse.json().catch(() => ({}));
        console.warn('🔧 ContractTransactionService: Deposit notification failed:', errorData);
      }
    } catch (error) {
      console.warn('🔧 ContractTransactionService: Deposit notification error:', error);
      // Don't throw - the transaction succeeded, notification failure shouldn't break the flow
    }
    
    return txHash;
  }

  /**
   * Deposits funds to the escrow contract
   */
  async depositFunds(params: ContractFundingParams & { contractAddress: string }): Promise<string> {
    const { contract, userAddress, contractAddress, config, utils } = params;
    
    console.log(`🚨 SECURITY DEBUG - depositFunds called with:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      userAddress: userAddress,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    });
    
    // Sign the deposit transaction
    const depositTx = await this.signer.signContractTransaction({
      contractAddress: ensureAddressPrefix(contractAddress),
      abi: ESCROW_CONTRACT_ABI,
      functionName: 'depositFunds',
      functionArgs: [],
      debugLabel: 'DEPOSIT'
    });
    
    console.log(`🚨 SECURITY DEBUG - depositFunds transaction signed:`, {
      contractAddress: contractAddress,
      signedTxLength: depositTx.length,
      contractId: contract.id
    });

    // Convert amount for API
    const amountInMicroUSDC = utils?.toMicroUSDC 
      ? utils.toMicroUSDC(contract.amount) 
      : (contract.amount * 1000000);

    // Submit to backend
    const response = await this.fetcher.authenticatedFetch('/api/chain/deposit-funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractAddress,
        userWalletAddress: userAddress,
        signedTransaction: depositTx,
        contractId: contract.id,
        buyerEmail: contract.buyerEmail,
        sellerEmail: contract.sellerEmail,
        contractDescription: contract.description,
        amount: amountInMicroUSDC.toString(),
        currency: "USDC",
        payoutDateTime: utils?.formatDateTimeWithTZ 
          ? utils.formatDateTimeWithTZ(contract.expiryTimestamp) 
          : new Date(contract.expiryTimestamp * 1000).toISOString(),
        contractLink: config.serviceLink
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Fund deposit failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Fund deposit failed');
    }

    return result.transactionHash || 'deposit-completed';
  }

  /**
   * Complete contract funding process: create contract, approve USDC, deposit funds
   */
  async fundContract(params: ContractFundingParams): Promise<{
    contractAddress: string;
    approvalTxHash: string;
    depositTxHash: string;
  }> {
    const { contract, userAddress, config, utils, onStatusUpdate } = params;

    console.log(`🚨 SECURITY DEBUG - fundContract started:`, {
      contractId: contract.id,
      userAddress: userAddress,
      timestamp: new Date().toISOString()
    });

    // Step 1: Create contract
    onStatusUpdate?.('create', 'Creating secure escrow contract...');
    const contractAddress = await this.createContract(contract, userAddress, config, utils);
    
    console.log(`🚨 SECURITY DEBUG - Contract created:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      step: 'CREATE_CONTRACT'
    });

    // Step 2: Approve USDC
    onStatusUpdate?.('approve', 'Approving USDC payment...');
    const approvalTxHash = await this.approveUSDC(
      contractAddress,
      contract.amount,
      contract.currency,
      userAddress,
      config,
      utils
    );
    
    console.log(`🚨 SECURITY DEBUG - USDC approved:`, {
      contractAddress: contractAddress,
      approvalTxHash: approvalTxHash,
      contractId: contract.id,
      step: 'APPROVE_USDC'
    });

    // Step 3: Deposit funds
    onStatusUpdate?.('deposit', 'Securing funds in escrow...');
    console.log(`🚨 SECURITY DEBUG - About to deposit funds:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      step: 'BEFORE_DEPOSIT'
    });
    
    const depositTxHash = await this.depositFunds({
      ...params,
      contractAddress
    });
    
    console.log(`🚨 SECURITY DEBUG - Funds deposited:`, {
      contractAddress: contractAddress,
      depositTxHash: depositTxHash,
      contractId: contract.id,
      step: 'DEPOSIT_COMPLETE'
    });

    // Step 4: Confirm transaction
    onStatusUpdate?.('confirm', 'Confirming transaction on blockchain...');

    return {
      contractAddress,
      approvalTxHash,
      depositTxHash
    };
  }

  /**
   * Complete contract funding process using fundAndSendTransaction (direct RPC)
   * This method bypasses the backend and sends transactions directly to the blockchain
   */
  async fundAndSendContract(params: ContractFundingParams): Promise<{
    contractAddress: string;
    approvalTxHash: string;
    depositTxHash: string;
  }> {
    const { contract, userAddress, config, utils, onStatusUpdate } = params;

    if (!this.signer.fundAndSendTransaction) {
      throw new Error('fundAndSendTransaction not supported by this signer');
    }

    console.log(`🚨 SECURITY DEBUG - fundAndSendContract started:`, {
      contractId: contract.id,
      userAddress: userAddress,
      timestamp: new Date().toISOString()
    });

    // Step 1: Create contract (still uses backend as it needs to store in MongoDB)
    onStatusUpdate?.('create', 'Creating secure escrow contract...');
    const contractAddress = await this.createContract(contract, userAddress, config, utils);
    
    console.log(`🚨 SECURITY DEBUG - Contract created:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      step: 'CREATE_CONTRACT'
    });

    // Step 2: Approve USDC using fundAndSendTransaction
    onStatusUpdate?.('approve', 'Approving USDC payment...');
    const approvalTxHash = await this.approveAndSendUSDC(
      contractAddress,
      contract.amount,
      contract.currency,
      userAddress,
      config,
      utils
    );
    
    console.log(`🚨 SECURITY DEBUG - USDC approved:`, {
      contractAddress: contractAddress,
      approvalTxHash: approvalTxHash,
      contractId: contract.id,
      step: 'APPROVE_USDC'
    });

    // Step 3: Deposit funds using fundAndSendTransaction
    onStatusUpdate?.('deposit', 'Securing funds in escrow...');
    console.log(`🚨 SECURITY DEBUG - About to deposit funds:`, {
      contractAddress: contractAddress,
      contractId: contract.id,
      step: 'BEFORE_DEPOSIT'
    });
    
    const depositTxHash = await this.depositAndSendFunds({
      ...params,
      contractAddress
    });
    
    console.log(`🚨 SECURITY DEBUG - Funds deposited:`, {
      contractAddress: contractAddress,
      depositTxHash: depositTxHash,
      contractId: contract.id,
      step: 'DEPOSIT_COMPLETE'
    });

    // Step 4: Confirm transaction
    onStatusUpdate?.('confirm', 'Confirming transaction on blockchain...');

    return {
      contractAddress,
      approvalTxHash,
      depositTxHash
    };
  }

  /**
   * Raise dispute using fundAndSendTransaction (direct RPC)
   * This method bypasses the backend and sends the transaction directly to the blockchain
   */
  async raiseAndSendDispute(params: {
    contractAddress: string;
    userAddress: string;
    reason: string;
    refundPercent: number;
    contract?: {
      id: string;
    };
  }): Promise<string> {
    const { contractAddress, userAddress, reason, refundPercent, contract } = params;

    if (!this.signer.fundAndSendTransaction) {
      throw new Error('fundAndSendTransaction not supported by this signer');
    }

    console.log(`🚨 SECURITY DEBUG - raiseAndSendDispute called with:`, {
      contractAddress: contractAddress,
      contractId: contract?.id,
      userAddress: userAddress,
      reason: reason,
      refundPercent: refundPercent,
      timestamp: new Date().toISOString()
    });

    // Create the raiseDispute transaction data
    const escrowContract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI);
    const txData = escrowContract.interface.encodeFunctionData('raiseDispute', []);

    console.log('🔧 ContractTransactionService: Raising dispute via fundAndSendTransaction');
    
    // Use fundAndSendTransaction to handle funding and sending in one step
    const txHash = await this.signer.fundAndSendTransaction({
      to: ensureAddressPrefix(contractAddress),
      data: txData
    });

    console.log('🔧 ContractTransactionService: Dispute transaction sent:', txHash);
    
    // Wait for transaction confirmation
    await this.waitForTransactionConfirmation(txHash, { 
      usdcContractAddress: '', 
      serviceLink: '' 
    });
    console.log('🔧 ContractTransactionService: Dispute confirmed');

    // Notify contractservice about the successful dispute
    if (contract?.id) {
      try {
        console.log('🔧 ContractTransactionService: Notifying contractservice about dispute');
        const disputeData: { reason?: string; refundPercent?: number } = {};
        
        // Only include non-empty values
        if (reason && reason.trim()) {
          disputeData.reason = reason;
        }
        if (typeof refundPercent === 'number' && refundPercent >= 0 && refundPercent <= 100) {
          disputeData.refundPercent = refundPercent;
        }

        const notificationResponse = await this.fetcher.authenticatedFetch(`/api/contracts/${contract.id}/dispute`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(disputeData)
        });

        if (notificationResponse.ok) {
          console.log('🔧 ContractTransactionService: Dispute notification sent successfully');
        } else {
          const errorData = await notificationResponse.json().catch(() => ({}));
          console.warn('🔧 ContractTransactionService: Dispute notification failed:', errorData);
        }
      } catch (error) {
        console.warn('🔧 ContractTransactionService: Dispute notification error:', error);
        // Don't throw - the transaction succeeded, notification failure shouldn't break the flow
      }
    } else {
      console.warn('🔧 ContractTransactionService: No contract ID available, skipping dispute notification');
    }
    
    console.log(`🚨 SECURITY DEBUG - raiseAndSendDispute completed:`, {
      contractAddress: contractAddress,
      contractId: contract?.id,
      txHash: txHash,
      timestamp: new Date().toISOString()
    });

    return txHash;
  }

  /**
   * Claim funds from expired escrow contract using chainservice as gas payer
   * This method uses the chainservice to handle the transaction and pay gas fees
   */
  async claimAndSendFunds(params: {
    contractAddress: string;
    userAddress: string;
  }): Promise<string> {
    const { contractAddress, userAddress } = params;

    console.log(`🚨 SECURITY DEBUG - claimAndSendFunds called with:`, {
      contractAddress: contractAddress,
      userAddress: userAddress,
      timestamp: new Date().toISOString()
    });

    console.log('🔧 ContractTransactionService: Claiming funds via chainservice as gas payer');
    
    // Call chainservice to handle the transaction and pay gas
    const response = await this.fetcher.authenticatedFetch('/api/chain/claim-funds-as-gas-payer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const txHash = result.transactionHash;
    console.log('🔧 ContractTransactionService: Claim funds transaction hash:', txHash);
    
    console.log(`🚨 SECURITY DEBUG - claimAndSendFunds completed:`, {
      contractAddress: contractAddress,
      userAddress: userAddress,
      txHash: txHash,
      timestamp: new Date().toISOString()
    });

    return txHash;
  }
}