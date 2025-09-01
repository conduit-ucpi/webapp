import { ethers } from 'ethers';
import { ERC20_ABI, ESCROW_CONTRACT_ABI } from '@conduit-ucpi/sdk';
import { CreateContractRequest } from '@/types';

export interface TransactionSigner {
  signContractTransaction: (params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
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
      buyer: userAddress,
      seller: contract.sellerAddress,
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
    
    if (!contractAddress) {
      console.error('🔧 ContractTransactionService: No address in response:', result);
      throw new Error(result.error || 'Contract creation failed - no address returned');
    }

    return contractAddress;
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
      contractAddress: config.usdcContractAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      functionArgs: [contractAddress, amountWei],
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
   * Deposits funds to the escrow contract
   */
  async depositFunds(params: ContractFundingParams & { contractAddress: string }): Promise<string> {
    const { contract, userAddress, contractAddress, config, utils } = params;
    
    // Sign the deposit transaction
    const depositTx = await this.signer.signContractTransaction({
      contractAddress,
      abi: ESCROW_CONTRACT_ABI,
      functionName: 'depositFunds',
      functionArgs: [],
      debugLabel: 'DEPOSIT'
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
    const { contract, userAddress, config, utils } = params;

    // Step 1: Create contract
    const contractAddress = await this.createContract(contract, userAddress, config, utils);

    // Step 2: Approve USDC
    const approvalTxHash = await this.approveUSDC(
      contractAddress,
      contract.amount,
      contract.currency,
      userAddress,
      config,
      utils
    );

    // Step 3: Deposit funds
    const depositTxHash = await this.depositFunds({
      ...params,
      contractAddress
    });

    return {
      contractAddress,
      approvalTxHash,
      depositTxHash
    };
  }
}