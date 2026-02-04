import { ethers } from 'ethers';
import { Config } from '@/types';
// WalletProvider removed - using ethers.BrowserProvider directly
import { toHex, toHexString, ensureHexPrefix } from '@/utils/hexUtils';
import { mLog } from '@/utils/mobileLogger';

// ERC20 ABI for USDC interactions
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Escrow Contract ABI
export const ESCROW_CONTRACT_ABI = [
  'function getContractInfo() view returns (address _buyer, address _seller, uint256 _amount, uint256 _expiryTimestamp, bytes32 _descriptionHash, uint8 _currentState, uint256 _currentTimestamp)',
  'function isExpired() view returns (bool)',
  'function canClaim() view returns (bool)',
  'function canDispute() view returns (bool)',
  'function isFunded() view returns (bool)',
  'function canDeposit() view returns (bool)',
  'function isDisputed() view returns (bool)',
  'function isClaimed() view returns (bool)',
  'function depositFunds()',
  'function raiseDispute()',
  'function claimFunds()',
  'function submitResolutionVote(uint256 _buyerPercentage)',
  'event FundsDeposited(address buyer, uint256 amount, uint256 timestamp)',
  'event DisputeRaised(uint256 timestamp)',
  'event DisputeResolved(address recipient, uint256 timestamp)',
  'event FundsClaimed(address recipient, uint256 amount, uint256 timestamp)'
];

import { formatWeiAsEthForLogging, formatGweiAsEthForLogging, formatMicroUSDCForLogging } from '@/utils/logging';

export class Web3Service {
  private static instance: Web3Service | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private readProvider: ethers.JsonRpcProvider | null = null; // Read-only RPC provider (no wallet needed)
  private config: Config;
  private onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void;
  private isDesktopQRSession: boolean = false;
  private isInitialized: boolean = false;

  // Network state cache to avoid repeated switch prompts
  private lastNetworkCheck: { chainId: bigint; timestamp: number } | null = null;
  private static NETWORK_CHECK_CACHE_MS = 60000; // Cache network verification for 60 seconds

  private constructor(config: Config) {
    this.config = config;
    // Initialize read-only provider immediately (no wallet needed)
    this.readProvider = new ethers.JsonRpcProvider(config.rpcUrl);
    console.log('[Web3Service] Read-only RPC provider created (no wallet access)');
  }

  /**
   * Get the singleton instance of Web3Service
   */
  static getInstance(config?: Config): Web3Service {
    if (!Web3Service.instance) {
      if (!config) {
        throw new Error('Config required for first Web3Service initialization');
      }
      console.log('[Web3Service] Creating new singleton instance');
      Web3Service.instance = new Web3Service(config);
    } else {
      console.log('[Web3Service] Returning existing singleton instance');
      // Update config if provided and different
      if (config && Web3Service.instance.config !== config) {
        console.log('[Web3Service] Updating config on existing instance');
        Web3Service.instance.config = config;
      }
    }
    return Web3Service.instance;
  }

  /**
   * Check if the Web3Service is properly initialized with a provider
   */
  isServiceInitialized(): boolean {
    return this.isInitialized && !!this.provider;
  }

  /**
   * Clear the singleton instance (for testing or reset)
   */
  static clearInstance(): void {
    console.log('[Web3Service] Clearing singleton instance');
    if (Web3Service.instance) {
      Web3Service.instance.clearState();
    }
    Web3Service.instance = null;
  }

  /**
   * Clear the internal state (called on logout)
   */
  clearState(): void {
    console.log('[Web3Service] Clearing internal state - resetting provider and initialization');
    this.provider = null;
    // Note: readProvider is NOT cleared - it's RPC-based and doesn't depend on wallet connection
    // It will be recreated with new config if needed
    this.isInitialized = false;
    this.isDesktopQRSession = false;
    this.onMobileActionRequired = undefined;
    this.lastNetworkCheck = null; // Clear network cache on state reset
  }

  /**
   * Verify the wallet is on the correct network, with caching to avoid repeated prompts
   *
   * @param forceCheck - If true, bypass cache and always check network
   * @returns true if on correct network or successfully switched
   * @throws Error if network switch fails or not supported
   */
  private async verifyAndSwitchNetwork(forceCheck: boolean = false): Promise<boolean> {
    if (!this.provider || !this.config.chainId) {
      return true; // Skip if no provider or chainId configured
    }

    const expectedChainId = BigInt(this.config.chainId);

    // Check cache first (unless forced)
    if (!forceCheck && this.lastNetworkCheck) {
      const cacheAge = Date.now() - this.lastNetworkCheck.timestamp;
      if (cacheAge < Web3Service.NETWORK_CHECK_CACHE_MS && this.lastNetworkCheck.chainId === expectedChainId) {
        console.log('[Web3Service] ✅ Using cached network verification (checked', Math.round(cacheAge / 1000), 'seconds ago)');
        return true;
      }
    }

    // Perform actual network check
    const network = await this.provider.getNetwork();

    if (network.chainId === expectedChainId) {
      // Cache successful verification
      this.lastNetworkCheck = { chainId: network.chainId, timestamp: Date.now() };
      console.log('[Web3Service] ✅ Network verified - on correct chain:', network.chainId.toString());
      return true;
    }

    // Wrong network - attempt to switch
    console.warn('[Web3Service] ⚠️ WRONG NETWORK detected!', {
      currentChain: network.chainId.toString(),
      currentName: network.name,
      expectedChain: expectedChainId.toString(),
      expectedName: this.getNetworkName(this.config.chainId)
    });

    try {
      const provider = this.provider as any;
      const rawProvider = provider._getProvider?.() || provider.provider;

      if (!rawProvider?.request) {
        throw new Error('Provider does not support network switching');
      }

      console.log('[Web3Service] 🔄 Automatically switching network...');
      const chainIdHex = `0x${expectedChainId.toString(16)}`;
      await rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });

      // Cache successful switch
      this.lastNetworkCheck = { chainId: expectedChainId, timestamp: Date.now() };
      console.log('[Web3Service] ✅ Network switched successfully!');
      return true;

    } catch (switchError: any) {
      console.error('[Web3Service] ❌ Failed to switch network:', switchError);

      throw new Error(
        `Cannot proceed: Wallet is on ${network.name} (chain ${network.chainId.toString()}) ` +
        `but expected ${this.getNetworkName(this.config.chainId)} (chain ${expectedChainId.toString()}). ` +
        `Please switch your wallet to the correct network manually.`
      );
    }
  }

  /**
   * Invalidate the network verification cache
   * Call this after errors to force a fresh network check on next transaction
   */
  public invalidateNetworkCache(): void {
    console.log('[Web3Service] Network cache invalidated - next transaction will verify network');
    this.lastNetworkCheck = null;
  }

  /**
   * Set callback for when mobile wallet action is required (for QR code sessions)
   */
  setMobileActionCallback(callback: (actionType: 'sign' | 'transaction') => void) {
    this.onMobileActionRequired = callback;
  }

  /**
   * Set whether this is a desktop-to-mobile QR session
   */
  setDesktopQRSession(isQRSession: boolean) {
    this.isDesktopQRSession = isQRSession;
    console.log('[Web3Service] Desktop QR session:', isQRSession);
  }

  /**
   * Initialize Web3Service with an ethers provider
   * This is the single unified initialization method
   * The provider should come from the auth system (already cached there)
   */
  async initialize(ethersProvider: ethers.BrowserProvider | null) {
    try {
      if (!ethersProvider) {
        throw new Error('No provider provided for initialization');
      }

      // Clear any existing state before initializing
      if (this.isInitialized) {
        console.log('[Web3Service] Clearing existing state before re-initialization');
        this.clearState();
      }

      console.log('[Web3Service] Initializing with LAZY provider (no wallet access during init)');

      // Store the ethers provider (single instance from auth system)
      this.provider = ethersProvider;

      // SKIP network validation during initialization to avoid mobile wallet popup
      // Network will be validated when first transaction is signed (unavoidable popup there anyway)
      // This eliminates the "unnecessary" popup #1 that happens when user already authenticated
      console.log('[Web3Service] ✅ Provider stored (network validation deferred until first transaction)');

      // Mark as initialized - we don't need to call getSigner() here
      // Getting the signer would trigger eth_requestAccounts which is forbidden
      // on already-connected sessions (Reown/WalletConnect restriction)
      // We'll get the signer lazily when actually needed for signing
      this.isInitialized = true;
      console.log('[Web3Service] ✅ Provider initialized successfully (signer will be obtained lazily when needed)');
      console.log('[Web3Service] 🎯 Using single provider instance from auth system');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize provider:', error);
      this.isInitialized = false;
      throw new Error('Provider initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Get human-readable network name from chain ID
   */
  private getNetworkName(chainId: number): string {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet';
      case 8453: return 'Base Mainnet';
      case 84532: return 'Base Sepolia';
      case 43113: return 'Avalanche Fuji';
      case 43114: return 'Avalanche Mainnet';
      default: return `Chain ${chainId}`;
    }
  }

  /**
   * Single centralized method for signing transactions
   * FIXED: Now uses the same unified ethers provider approach as balance reading
   * All transaction signing in the app MUST go through this method
   */
  async signTransaction(txParams: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: bigint;
    gasPrice?: bigint;
    nonce?: number;
  }): Promise<string> {
    console.log('[Web3Service.signTransaction] Starting unified transaction signing...');

    if (!this.isServiceInitialized()) {
      throw new Error('Web3Service not initialized. Please ensure the wallet is connected and provider is properly initialized.');
    }

    // If this is a desktop-to-mobile QR session, show the mobile prompt
    if (this.isDesktopQRSession && this.onMobileActionRequired) {
      console.log('[Web3Service] Desktop QR session detected, showing mobile prompt for transaction');
      this.onMobileActionRequired('transaction');
    }

    console.log('[Web3Service.signTransaction] Using unified ethers provider (same as balance reading)');

    // Get the actual wallet address using unified approach
    const fromAddress = await this.getUserAddress();

    // Get nonce using READ-ONLY RPC (prevents mobile wallet popups)
    if (!this.readProvider) {
      throw new Error('Read provider not initialized');
    }
    const nonce = txParams.nonce ?? await this.readProvider.getTransactionCount(fromAddress);

    // Use reliable gas price sources instead of trusting unknown providers
    let gasPrice = txParams.gasPrice;
    if (!gasPrice) {
      // Use known-good gas prices for specific networks instead of unreliable provider estimates
      if (this.config.chainId === 8453) {
        // Base mainnet: Use reliable external API or hardcoded reasonable values
        gasPrice = await this.getReliableBaseGasPrice();
      } else if (this.config.chainId === 84532) {
        // Base testnet: Use configured max gas price
        gasPrice = this.getMaxGasPriceInWei();
      } else {
        // Other networks: Use READ-ONLY RPC instead of wallet provider (prevents mobile popups)
        try {
          const feeData = await this.readProvider.getFeeData();
          console.log('🔍 DEBUGGING: Raw fee data from RPC:', {
            gasPrice: feeData.gasPrice?.toString(),
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
          });

          // Analyze if the provider might be returning gwei instead of wei
          if (feeData.gasPrice) {
            const gweiValue = Number(feeData.gasPrice) / 1000000000;
            const weiValue = Number(feeData.gasPrice);
            console.log('🔍 DEBUGGING: Provider gas price analysis:');
            console.log(`  If this is wei: ${formatWeiAsEthForLogging(weiValue)} = ${formatGweiAsEthForLogging(gweiValue)}`);
            console.log(`  If this is gwei: ${formatGweiAsEthForLogging(weiValue)} = ${formatWeiAsEthForLogging(weiValue * 1000000000)}`);

            // If the "wei" value is suspiciously small (like 5-50), it's probably gwei
            if (feeData.gasPrice < this.getMaxGasPriceInWei() && feeData.gasPrice > BigInt(0)) {
              console.log('🚨 PROVIDER UNIT MISMATCH: Provider likely returning gwei, converting to wei');
              gasPrice = feeData.gasPrice * BigInt(1000000000); // Convert gwei to wei
            } else {
              gasPrice = feeData.gasPrice;
            }
          } else {
            gasPrice = BigInt(this.config.minGasWei);
          }

          // Final sanity check
          const MAX_REASONABLE_GAS_PRICE = BigInt(50000000000); // 50 gwei max
          if (gasPrice > MAX_REASONABLE_GAS_PRICE) {
            console.log('🚨 GAS PRICE TOO HIGH: Capping at 50 gwei');
            gasPrice = MAX_REASONABLE_GAS_PRICE;
          }

        } catch (error) {
          gasPrice = BigInt(this.config.minGasWei);
        }
      }

      console.log(`Using realistic gas price for network ${this.config.chainId}: ${formatWeiAsEthForLogging(gasPrice)}`);
      console.log(`Expected transaction cost for 100k gas: ${formatWeiAsEthForLogging(gasPrice * BigInt(100000))} ETH`);
    }

    // Use provided gasLimit or throw error (caller should estimate)
    if (!txParams.gasLimit) {
      throw new Error('Gas limit must be provided');
    }

    console.log('[Web3Service.signTransaction] Transaction details:', {
      from: fromAddress,
      to: txParams.to,
      value: txParams.value || '0x0',
      gasLimit: txParams.gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      nonce: nonce
    });

    try {
      // Use unified ethers signer for all wallet types
      console.log('[Web3Service.signTransaction] Using unified ethers signer');
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }
      const signer = await this.provider.getSigner();

      // Build transaction object with Web3Auth compatibility
      let tx: any = {
        from: fromAddress,
        to: txParams.to,
        data: txParams.data,
        value: txParams.value || '0x0',
        gasLimit: txParams.gasLimit,
        nonce: nonce,
        chainId: this.config.chainId
      };

      // Detect if this is an injected wallet (MetaMask, Coinbase, etc.)
      const isInjectedWallet = this.isInjectedWalletProvider();

      if (isInjectedWallet) {
        // For injected wallets, don't override gas parameters
        console.log('🦊 Using injected wallet for signing - letting wallet handle gas pricing');
        // Don't set gasPrice, maxFeePerGas, or maxPriorityFeePerGas - let the wallet decide
      } else {
        // For other providers, use our custom gas pricing
        console.log('🔧 Using custom provider for signing - applying our gas pricing logic');

        // Check if we should use EIP-1559 format (use RPC to avoid mobile wallet popups)
        try {
          const providerFeeData = await this.readProvider.getFeeData();
          if (providerFeeData.maxFeePerGas && providerFeeData.maxPriorityFeePerGas) {
            // Use EIP-1559 transaction format with our reliable fee data
            const reliableFees = await this.getReliableEIP1559FeeData();
            tx.maxFeePerGas = reliableFees.maxFeePerGas;
            tx.maxPriorityFeePerGas = reliableFees.maxPriorityFeePerGas;
            console.log('Using EIP-1559 transaction format with reliable Base RPC fees');
            console.log(`Final EIP-1559 fees: maxFee=${formatWeiAsEthForLogging(tx.maxFeePerGas)}, priority=${formatWeiAsEthForLogging(tx.maxPriorityFeePerGas)}`);
          } else {
            // Use legacy transaction format
            tx.gasPrice = gasPrice;
            console.log('Using legacy transaction format for signing');
          }
        } catch (error) {
          // Fallback to legacy format
          tx.gasPrice = gasPrice;
          console.log('Fallback to legacy transaction format for signing');
        }
      }

      console.log('[Web3Service.signTransaction] Signing transaction via unified approach...');

      // Sign the transaction using ethers signer (works with any wallet type)
      const signedTx = await signer.signTransaction(tx);
      console.log('[Web3Service.signTransaction] ✅ Transaction signed successfully via unified provider');
      return signedTx;

    } catch (error) {
      console.error('[Web3Service.signTransaction] ❌ Transaction signing failed:', error);
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return await this.provider.getSigner();
  }

  async getUserAddress(): Promise<string> {
    // CRITICAL FIX: Check if auth system has a known address first
    // This avoids querying the wallet provider which might have stale cached address
    // from a previous session (especially with Dynamic SDK's WalletClient caching)
    if (typeof window !== 'undefined') {
      // Try to get address from auth context (most reliable source)
      const authUser = (window as any).authUser;
      if (authUser && authUser.walletAddress) {
        console.log('[Web3Service.getUserAddress] Using address from auth context:', authUser.walletAddress);
        return authUser.walletAddress;
      }

      // Try Dynamic user as fallback
      const dynamicUser = (window as any).dynamicUser;
      if (dynamicUser && dynamicUser.walletAddress) {
        console.log('[Web3Service.getUserAddress] Using address from Dynamic user:', dynamicUser.walletAddress);
        return dynamicUser.walletAddress;
      }
    }

    // Fall back to querying the provider (may have stale address from cached WalletClient)
    if (this.provider) {
      console.log('[Web3Service.getUserAddress] Querying provider for address (auth context not available)');
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      console.log('[Web3Service.getUserAddress] Got address from provider:', address);
      return address;
    }

    // No provider available
    throw new Error('No provider initialized and no address in auth context');
  }
  
  /**
   * Generate a signature-based authentication token
   * This is used when external wallets don't provide JWT tokens
   */
  async generateSignatureAuthToken(): Promise<string> {
    if (!this.provider) {
      throw new Error('No provider available for signature generation');
    }

    try {
      console.log('[Web3Service.generateSignatureAuthToken] Generating signature-based auth token...');
      
      // Get wallet address
      const walletAddress = await this.getUserAddress();
      
      // Create a message to sign that includes timestamp and wallet address
      // This prevents replay attacks and proves wallet ownership
      const timestamp = Date.now();
      const nonce = Math.random().toString(36).substring(2, 15);
      const message = `Authenticate wallet ${walletAddress} at ${timestamp} with nonce ${nonce}`;

      console.log('[Web3Service.generateSignatureAuthToken] Signing message:', message);

      // If this is a desktop-to-mobile QR session, show the mobile prompt
      if (this.isDesktopQRSession && this.onMobileActionRequired) {
        console.log('[Web3Service] Desktop QR session detected, showing mobile prompt for signature');
        this.onMobileActionRequired('sign');
      }

      // Sign the message using ethers signer
      if (!this.provider) {
        throw new Error('Ethers provider not available');
      }
      const signer = await this.provider.getSigner();
      const signature = await signer.signMessage(message);

      // Create a base64-encoded JSON token
      const signatureToken = btoa(JSON.stringify({
        type: 'signature_auth',
        walletAddress,
        message,
        signature,
        timestamp,
        nonce,
        issuer: 'unified_web3_service',
        // Add a simple header/payload structure for compatibility
        header: { alg: 'ECDSA', typ: 'SIG' },
        payload: { 
          sub: walletAddress, 
          iat: Math.floor(timestamp / 1000),
          iss: 'unified_web3_service',
          wallet_type: 'external'
        }
      }));

      console.log('[Web3Service.generateSignatureAuthToken] ✅ Signature token generated');
      return signatureToken;

    } catch (error) {
      console.error('[Web3Service.generateSignatureAuthToken] ❌ Failed:', error);
      throw new Error(`Signature authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUSDCBalance(userAddress: string): Promise<string> {
    if (!this.readProvider) {
      throw new Error('Read provider not initialized');
    }

    console.log('getUSDCBalance - checking for address:', userAddress);
    console.log('getUSDCBalance - USDC contract:', this.config.usdcContractAddress);
    console.log('getUSDCBalance - Using READ-ONLY RPC provider (no wallet access)');

    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.readProvider  // ← Use read provider, not wallet provider
    );

    const balance = await usdcContract.balanceOf(userAddress);
    const decimals = await usdcContract.decimals();

    console.log(`getUSDCBalance - raw balance: ${formatMicroUSDCForLogging(balance)}`);
    console.log('getUSDCBalance - decimals:', decimals);
    const formattedBalance = ethers.formatUnits(balance, decimals);
    console.log('getUSDCBalance - formatted balance:', formattedBalance);

    return formattedBalance;
  }

  async getNativeBalance(userAddress: string): Promise<string> {
    if (!this.readProvider) {
      throw new Error('Read provider not initialized');
    }

    console.log('getNativeBalance - checking for address:', userAddress);
    console.log('getNativeBalance - Using READ-ONLY RPC provider (no wallet access)');

    const balance = await this.readProvider.getBalance(userAddress);
    const formattedBalance = ethers.formatEther(balance);

    console.log('getNativeBalance - raw balance (wei):', balance.toString());
    console.log('getNativeBalance - formatted balance:', formattedBalance);

    return formattedBalance;
  }

  async getUSDCAllowance(userAddress: string, spenderAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.provider
    );

    const allowance = await usdcContract.allowance(userAddress, spenderAddress);
    const decimals = await usdcContract.decimals();
    
    return ethers.formatUnits(allowance, decimals);
  }

  // Deprecated - use signUSDCApproval instead
  async approveUSDC(amount: string, spenderAddress: string): Promise<string> {
    throw new Error('approveUSDC is deprecated. Use signUSDCApproval method instead.');
  }

  // Hash description for smart contract compatibility
  hashDescription(description: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(description));
  }


  // Get contract info from deployed escrow contract
  async getContractInfo(contractAddress: string) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      this.provider
    );

    const info = await contract.getContractInfo();
    return {
      buyer: info._buyer,
      seller: info._seller,
      amount: ethers.formatUnits(info._amount, 6), // USDC has 6 decimals
      expiryTimestamp: Number(info._expiryTimestamp),
      descriptionHash: info._descriptionHash,
      currentState: Number(info._currentState),
      currentTimestamp: Number(info._currentTimestamp)
    };
  }

  // Check various contract states
  async getContractState(contractAddress: string) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      this.provider
    );

    const [isExpired, canClaim, canDispute, isFunded, canDeposit, isDisputed, isClaimed] = await Promise.all([
      contract.isExpired(),
      contract.canClaim(),
      contract.canDispute(),
      contract.isFunded(),
      contract.canDeposit(),
      contract.isDisputed(),
      contract.isClaimed()
    ]);

    return {
      isExpired,
      canClaim,
      canDispute,
      isFunded,
      canDeposit,
      isDisputed,
      isClaimed
    };
  }

  /**
   * Generic method for signing any contract transaction
   * This is the ONLY method that should be used for contract interactions
   */
  async signContractTransaction(params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
  }): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const userAddress = await this.getUserAddress();
    const contract = new ethers.Contract(params.contractAddress, params.abi, this.provider);

    // Create transaction data
    const txData = contract.interface.encodeFunctionData(params.functionName, params.functionArgs);
    
    // Estimate gas with direct RPC call to bypass Web3Auth's stale cached estimates
    let gasEstimate: bigint;
    try {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [{
            from: userAddress,
            to: params.contractAddress,
            data: txData
          }],
          id: 1
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.result) {
          gasEstimate = BigInt(result.result);
          console.log(`Using live RPC gas estimate: ${gasEstimate.toString()} gas`);
        } else {
          throw new Error('No gas estimate in RPC response');
        }
      } else {
        throw new Error('RPC call failed');
      }
    } catch (error) {
      console.warn('Failed to get live gas estimate from RPC, falling back to provider:', error);
      // Fallback to provider's gas estimation if RPC call fails
      gasEstimate = await this.provider!.estimateGas({
        from: userAddress,
        to: params.contractAddress,
        data: txData
      });
    }
    
    if (params.debugLabel) {
      console.log(`=== ${params.debugLabel} TRANSACTION DEBUG ===`);
      console.log('Contract:', params.contractAddress);
      console.log('Function:', params.functionName);
      console.log('Args:', params.functionArgs);
      console.log(`Gas estimate: ${gasEstimate.toString()} gas`);
    }
    
    // Use centralized signing method
    const signedTx = await this.signTransaction({
      to: params.contractAddress,
      data: txData,
      gasLimit: gasEstimate
    });
    
    if (params.debugLabel) {
      console.log('Signed transaction:', signedTx);
      console.log(`=== ${params.debugLabel} TRANSACTION DEBUG END ===`);
    }
    
    return signedTx;
  }


  // Send AVAX to an address
  async sendAVAX(to: string, amount: string): Promise<{ hash: string }> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const userAddress = await this.getUserAddress();
    const value = ethers.parseEther(amount);
    
    // Estimate gas for AVAX transfer with direct RPC call to bypass Web3Auth's stale cached estimates
    let gasEstimate: bigint;
    try {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [{
            from: userAddress,
            to: to,
            value: toHex(value)
          }],
          id: 1
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.result) {
          gasEstimate = BigInt(result.result);
          console.log(`Using live RPC gas estimate for AVAX transfer: ${gasEstimate.toString()} gas`);
        } else {
          throw new Error('No gas estimate in RPC response');
        }
      } else {
        throw new Error('RPC call failed');
      }
    } catch (error) {
      console.warn('Failed to get live gas estimate from RPC for AVAX transfer, falling back to RPC estimateGas:', error);
      // Fallback to RPC's gas estimation if direct RPC call fails (avoid wallet provider popups)
      if (!this.readProvider) {
        throw new Error('Read provider not initialized');
      }
      gasEstimate = await this.readProvider.estimateGas({
        from: userAddress,
        to: to,
        value: value
      });
    }

    // Sign transaction
    const signedTx = await this.signTransaction({
      to: to,
      data: '0x',
      value: toHex(value),
      gasLimit: gasEstimate
    });

    // Send transaction
    const txResponse = await this.provider.broadcastTransaction(signedTx);
    return { hash: txResponse.hash };
  }

  // Sign USDC transfer transaction (without broadcasting)
  async signUSDCTransfer(to: string, amount: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const decimals = 6; // USDC has 6 decimals
    const amountWei = ethers.parseUnits(amount, decimals);

    // Sign transaction using generic method
    const signedTx = await this.signContractTransaction({
      contractAddress: this.config.usdcContractAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      functionArgs: [to, amountWei],
      debugLabel: 'USDC TRANSFER'
    });

    return signedTx;
  }

  // Send USDC to an address (direct RPC - deprecated, use signUSDCTransfer with chain-service instead)
  async sendUSDC(to: string, amount: string): Promise<{ hash: string }> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const decimals = 6; // USDC has 6 decimals
    const amountWei = ethers.parseUnits(amount, decimals);

    // Sign transaction using generic method
    const signedTx = await this.signContractTransaction({
      contractAddress: this.config.usdcContractAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      functionArgs: [to, amountWei],
      debugLabel: 'USDC TRANSFER'
    });

    // Send transaction
    const txResponse = await this.provider.broadcastTransaction(signedTx);
    return { hash: txResponse.hash };
  }

  /**
   * Check if the current provider is an injected wallet (MetaMask, Coinbase Wallet, etc.)
   * Injected wallets should handle their own gas pricing
   */
  private isInjectedWalletProvider(): boolean {
    if (!this.provider) return false;

    try {
      // Check if the provider has an underlying EIP-1193 provider (injected wallet)
      // @ts-ignore - accessing internal property
      const internalProvider = this.provider._getConnection?.()?.provider || this.provider.provider;

      // Check for common injected wallet signatures
      if (internalProvider) {
        // @ts-ignore
        const isMetaMask = internalProvider.isMetaMask === true;
        // @ts-ignore
        const isCoinbase = internalProvider.isCoinbaseWallet === true;
        // @ts-ignore
        const isInjected = internalProvider.isInjected === true;
        // @ts-ignore
        const hasEthereum = typeof window !== 'undefined' && window.ethereum === internalProvider;

        const isInjectedWallet = isMetaMask || isCoinbase || isInjected || hasEthereum;

        if (isInjectedWallet) {
          console.log('[Web3Service] Detected injected wallet provider (MetaMask/Coinbase/etc.) - will let wallet handle gas pricing');
        }

        return isInjectedWallet;
      }
    } catch (error) {
      console.warn('[Web3Service] Error detecting injected wallet:', error);
    }

    return false;
  }

  /**
   * Fund wallet with gas and send transaction
   * FIXED: Now uses the same unified ethers provider approach as balance reading
   * 1. Estimates gas for the transaction using ethers provider
   * 2. Calls chainservice to fund wallet with estimated gas + 20%
   * 3. Sends the transaction via ethers provider (consistent with balance reading)
   *
   * @param txParams Transaction parameters (to, data, value, etc.)
   * @returns Transaction hash
   */
  async fundAndSendTransaction(txParams: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: bigint;
    gasPrice?: bigint;
  }): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    console.log('[Web3Service.fundAndSendTransaction] Using unified ethers provider approach (same as balance reading)');

    // CRITICAL: Verify network BEFORE sending transaction
    // Uses cached verification to avoid repeated prompts during multi-transaction flows
    await this.verifyAndSwitchNetwork();

    const userAddress = await this.getUserAddress();

    // Step 1: Estimate gas using our RPC directly to avoid Web3Auth pre-validation issues
    let gasEstimate: bigint = BigInt(0);
    if (txParams.gasLimit) {
      gasEstimate = txParams.gasLimit;
      console.log(`Using provided gas limit: ${gasEstimate.toString()} gas`);
    } else {
      try {
        // Use our Base RPC directly instead of the provider to avoid Web3Auth's internal validation
        console.log('Estimating gas via Base RPC directly (bypassing Web3Auth provider)...');

        const estimateResponse = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_estimateGas',
            params: [{
              from: userAddress,
              to: txParams.to,
              data: txParams.data,
              value: txParams.value || '0x0'
            }],
            id: 1
          })
        });

        if (estimateResponse.ok) {
          const estimateData = await estimateResponse.json();
          if (estimateData.result) {
            gasEstimate = BigInt(estimateData.result);
            console.log(`✅ Gas estimate from Base RPC: ${gasEstimate.toString()} gas`);
          } else {
            throw new Error('No result from RPC gas estimation');
          }
        } else {
          const errorText = await estimateResponse.text();
          console.warn('RPC gas estimation response not ok:', errorText);
          throw new Error('RPC gas estimation failed');
        }
      } catch (error) {
        console.warn('RPC gas estimation failed, using safe fallback:', error);

        // Check if this is a network connectivity issue
        if (error instanceof Error && error.message.includes('fetch')) {
          console.warn('⚠️ Network connectivity issue with RPC. Using fallback gas estimate.');
        }

        // Use appropriate Foundry gas estimate fallback based on transaction type
        // Detect transaction type from encoded function data
        const transactionType = this.detectTransactionType(txParams.data);
        let foundryGasEstimate: number;

        if (transactionType === 'depositFunds') {
          foundryGasEstimate = parseInt(this.config.depositFundsFoundryGas || '200000');
          console.log(`Using Foundry fallback for depositFunds (DEPOSIT_FUNDS_FOUNDRY_GAS): ${foundryGasEstimate} gas`);
        } else {
          // Default to USDC operations (approve, transfer, etc.)
          foundryGasEstimate = parseInt(this.config.usdcGrantFoundryGas || '100000');
          console.log(`Using Foundry fallback for USDC operations (USDC_GRANT_FOUNDRY_GAS): ${foundryGasEstimate} gas`);
        }

        // Validate foundryGasEstimate is a valid number before converting to BigInt
        if (isNaN(foundryGasEstimate) || foundryGasEstimate <= 0) {
          console.warn(`Invalid Foundry gas estimate: ${foundryGasEstimate}, using default 100000`);
          foundryGasEstimate = 100000;
        }

        gasEstimate = BigInt(foundryGasEstimate);
      }
    }

    // Step 2: Get gas price for funding calculation
    // CRITICAL: Query gas price ONCE and use for BOTH funding AND transaction execution
    // This prevents mismatch between funding amount and actual transaction cost
    let gasPrice: bigint = txParams.gasPrice || BigInt(0);
    let walletProviderFeeData: any = null; // Store for reuse in transaction execution
    const isInjectedWallet = this.isInjectedWalletProvider();

    if (!txParams.gasPrice) {
      // Get chain ID using READ-ONLY RPC (no wallet access!)
      // This prevents MetaMask popups on mobile during gas price fetching
      if (!this.readProvider) {
        throw new Error('Read provider not initialized');
      }
      const chainId = await this.readProvider.getNetwork().then(n => n.chainId);
      const isBaseNetwork = chainId === BigInt(8453) || chainId === BigInt(84532); // Base mainnet or testnet

      // Use RPC-only gas price fetching to avoid wallet provider popups on mobile
      console.log('🔍 Fetching gas prices from RPC (no wallet access - prevents mobile popups)');

      let rpcFees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | null = null;

      // Get gas from Base RPC (for Base networks) or use fallback
      if (isBaseNetwork) {
        try {
          console.log('📡 Fetching gas price from Base RPC...');
          rpcFees = await this.getReliableEIP1559FeeData();
          console.log('✅ Base RPC returned:');
          console.log(`   maxFeePerGas: ${formatWeiAsEthForLogging(rpcFees.maxFeePerGas)} = ${(Number(rpcFees.maxFeePerGas) / 1e9).toFixed(4)} gwei`);
          console.log(`   maxPriorityFeePerGas: ${formatWeiAsEthForLogging(rpcFees.maxPriorityFeePerGas)} = ${(Number(rpcFees.maxPriorityFeePerGas) / 1e9).toFixed(4)} gwei`);
        } catch (error) {
          console.error('❌ Base RPC fetch failed:', error);
        }
      }

      // Select gas price to use (RPC only - no wallet provider to avoid mobile popups)
      if (isBaseNetwork && rpcFees) {
        console.log('💰 Using Base RPC fees (Base network detected)');
        gasPrice = rpcFees.maxFeePerGas;
        walletProviderFeeData = {
          gasPrice: null,
          maxFeePerGas: rpcFees.maxFeePerGas,
          maxPriorityFeePerGas: rpcFees.maxPriorityFeePerGas
        };
      } else {
        // For non-Base networks, use config fallback
        console.log('💰 Using fallback gas price from config (non-Base network)');
        gasPrice = this.getMaxGasPriceInWei();
        walletProviderFeeData = {
          gasPrice: gasPrice,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null
        };
      }

      console.log(`Expected transaction cost for 100k gas: ${formatWeiAsEthForLogging(gasPrice * BigInt(100000))} ETH`);
    }

    // Step 3: Calculate total gas needed with buffer from config
    // Use the configured GAS_PRICE_BUFFER for funding calculation
    const gasPriceBuffer = parseFloat(this.config.gasPriceBuffer);
    const fundingBufferPercent = Math.round(gasPriceBuffer * 100);
    const totalGasNeeded = (gasEstimate * gasPrice * BigInt(fundingBufferPercent)) / BigInt(100);

    console.log(`💰 Using ${gasPriceBuffer}x (${fundingBufferPercent - 100}% extra) funding buffer from GAS_PRICE_BUFFER config`);

    const gasPriceEth = Number(gasPrice) / 1e18;
    const baseCostEth = Number(gasEstimate * gasPrice) / 1e18;
    const totalGasNeededEth = Number(totalGasNeeded) / 1e18;

    console.log('');
    console.log('📊 GAS CALCULATION SUMMARY:');
    console.log('─'.repeat(60));
    console.log(`   Wallet Type: ${isInjectedWallet ? 'Injected (MetaMask/etc.)' : 'Custom Provider'}`);
    console.log(`   Gas Estimate: ${gasEstimate.toString()} gas`);
    console.log(`   Gas Price: ${gasPriceEth.toExponential(4)} ETH (${(Number(gasPrice) / 1e9).toFixed(6)} gwei)`);
    console.log(`   Base Cost: ${baseCostEth.toExponential(4)} ETH`);
    console.log(`   Funding Buffer: ${gasPriceBuffer}x from GAS_PRICE_BUFFER config`);
    console.log(`   Total Gas Needed: ${totalGasNeededEth.toExponential(4)} ETH`);
    console.log('─'.repeat(60));
    console.log('');

    // Step 4: Call chainservice to fund wallet
    console.log('Requesting wallet funding from chainservice...');
    const fundResponse = await fetch('/api/chain/fund-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        walletAddress: userAddress,
        totalAmountNeededWei: totalGasNeeded.toString()
      })
    });

    if (!fundResponse.ok) {
      const errorData = await fundResponse.json().catch(() => ({}));
      throw new Error(`Failed to fund wallet: ${errorData.error || fundResponse.statusText}`);
    }

    const fundResult = await fundResponse.json();
    if (!fundResult.success) {
      throw new Error(`Wallet funding failed: ${fundResult.error || 'Unknown error'}`);
    }

    console.log('Wallet funded successfully:', fundResult.message || 'Ready to send transaction');

    // Step 5: Send transaction using the same unified ethers provider approach
    console.log('[Web3Service.fundAndSendTransaction] Sending transaction via unified ethers provider...');

    try {
      // CRITICAL FIX: Don't call getSigner() here - it triggers eth_requestAccounts which is
      // forbidden on embedded wallets (Farcaster, Dynamic, WalletConnect) after initial connection.
      // We only need the user address, which getUserAddress() can provide from auth context.
      // The signer was only used to get the address via signer.getAddress() at line 1232.
      console.log('[Web3Service.fundAndSendTransaction] Getting user address from auth context (no getSigner call)');
      // Note: We removed "const signer = await this.provider.getSigner();" from here

      // Apply gas buffer for transaction execution (reuse gasPriceBuffer from earlier)
      const bufferedGasLimit = BigInt(Math.round(Number(gasEstimate) * gasPriceBuffer));

      const originalCostEth = Number(gasEstimate * gasPrice) / 1e18;
      const bufferedCostEth = Number(bufferedGasLimit * gasPrice) / 1e18;

      console.log('');
      console.log('🔧 TRANSACTION EXECUTION GAS BUFFER:');
      console.log('─'.repeat(60));
      console.log(`   Original Estimate: ${gasEstimate.toString()} gas`);
      console.log(`   Original Cost: ${originalCostEth.toExponential(4)} ETH`);
      console.log(`   Buffer Multiplier (GAS_PRICE_BUFFER): ${gasPriceBuffer}x`);
      console.log(`   Buffered Gas Limit: ${bufferedGasLimit.toString()} gas`);
      console.log(`   Buffered Cost: ${bufferedCostEth.toExponential(4)} ETH`);
      console.log('─'.repeat(60));
      console.log('');

      // Build transaction object for ethers with Web3Auth compatibility
      // Note: We don't need to manually fetch nonce/chainId anymore!
      // The HybridProvider automatically routes eth_getTransactionCount and eth_chainId
      // to the Base RPC instead of the wallet provider, so they work even after app-switching.
      let tx: any = {
        to: txParams.to,
        data: txParams.data,
        value: txParams.value || '0x0',
        gasLimit: bufferedGasLimit
      };

      // Use the isInjectedWallet flag we detected earlier for gas pricing decisions

      if (isInjectedWallet) {
        // For injected wallets (MetaMask, Coinbase, etc.), don't override gas parameters
        // Let the wallet handle gas pricing to avoid rejection
        console.log('🦊 Using injected wallet - letting wallet handle gas pricing automatically');
        console.log('📝 Transaction will be sent without gas price overrides');
        // Don't set gasPrice, maxFeePerGas, or maxPriorityFeePerGas - let the wallet decide
      } else {
        // For other providers (Web3Auth, Dynamic, etc.), use the SAME gas pricing we used for funding
        console.log('🔧 Using custom provider - applying gas pricing from earlier calculation (same as funding)');

        // CRITICAL: Use the SAME feeData we selected earlier for funding
        // This ensures funding amount matches actual transaction cost
        // NOTE: walletProviderFeeData contains whichever source we chose (RPC or provider)
        if (walletProviderFeeData && walletProviderFeeData.maxFeePerGas && walletProviderFeeData.maxPriorityFeePerGas) {
          // Use EIP-1559 transaction format with the SAME fees used for funding
          tx.maxFeePerGas = walletProviderFeeData.maxFeePerGas;
          tx.maxPriorityFeePerGas = walletProviderFeeData.maxPriorityFeePerGas;
          console.log('✅ Using EIP-1559 transaction format with selected fees (same as funding)');
          console.log(`   maxFeePerGas: ${formatWeiAsEthForLogging(tx.maxFeePerGas)} (${(Number(tx.maxFeePerGas) / 1e9).toFixed(6)} gwei)`);
          console.log(`   maxPriorityFeePerGas: ${formatWeiAsEthForLogging(tx.maxPriorityFeePerGas)} (${(Number(tx.maxPriorityFeePerGas) / 1e9).toFixed(6)} gwei)`);
        } else if (walletProviderFeeData && walletProviderFeeData.gasPrice) {
          // Use legacy transaction format
          tx.gasPrice = gasPrice;
          console.log('✅ Using legacy transaction format with wallet provider gas price (same as funding)');
          console.log(`   gasPrice: ${formatWeiAsEthForLogging(tx.gasPrice)} (${(Number(tx.gasPrice) / 1e9).toFixed(6)} gwei)`);
        } else {
          // Fallback to the gasPrice variable we calculated earlier
          tx.gasPrice = gasPrice;
          console.log('✅ Using gas price from funding calculation (fallback)');
          console.log(`   gasPrice: ${formatWeiAsEthForLogging(tx.gasPrice)} (${(Number(tx.gasPrice) / 1e9).toFixed(6)} gwei)`);
        }
      }

      // Validate transaction cost against MAX_GAS_COST_GWEI limit using buffered gas limit
      // Skip validation for injected wallets since they handle their own gas pricing
      if (isInjectedWallet) {
        console.log('');
        console.log('✅ TRANSACTION VALIDATION (INJECTED WALLET):');
        console.log('─'.repeat(60));
        console.log(`   Buffered Gas Limit: ${bufferedGasLimit.toString()} gas`);
        console.log(`   Gas Price: Managed by wallet (not validated)`);
        console.log(`   Status: ✅ SKIPPED - Wallet handles gas pricing`);
        console.log('='.repeat(80));
        console.log('');
      } else {
        // Validate for non-injected wallets
        let transactionCostWei: bigint;
        if (tx.maxFeePerGas) {
          // EIP-1559 transaction
          transactionCostWei = tx.maxFeePerGas * bufferedGasLimit;
        } else if (tx.gasPrice) {
          // Legacy transaction
          transactionCostWei = tx.gasPrice * bufferedGasLimit;
        } else {
          throw new Error('No gas price set for transaction');
        }

        const maxAllowedCostWei = this.getMaxGasCostInWei();
        const gasPriceUsed = tx.maxFeePerGas || tx.gasPrice || BigInt(0);

        // Convert to ETH for display
        const transactionCostEth = Number(transactionCostWei) / 1e18;
        const maxAllowedCostEth = Number(maxAllowedCostWei) / 1e18;
        const gasPriceUsedEth = Number(gasPriceUsed) / 1e18;

        console.log('');
        console.log('✅ FINAL TRANSACTION COST VALIDATION:');
        console.log('─'.repeat(60));
        console.log(`   Buffered Gas Limit: ${bufferedGasLimit.toString()} gas`);
        console.log(`   Gas Price Used: ${gasPriceUsedEth.toExponential(4)} ETH`);
        console.log(`   Transaction Cost: ${transactionCostEth.toExponential(4)} ETH`);
        console.log(`   MAX_GAS_COST_GWEI Limit: ${maxAllowedCostEth.toExponential(4)} ETH`);
        console.log(`   Headroom: ${((maxAllowedCostEth / transactionCostEth) * 100).toFixed(1)}% available`);
        console.log('─'.repeat(60));

        if (transactionCostWei > maxAllowedCostWei) {
          console.log('');
          console.log('❌ VALIDATION FAILED:');
          console.log(`   Transaction cost ${transactionCostEth.toExponential(4)} ETH exceeds limit ${maxAllowedCostEth.toExponential(4)} ETH`);
          console.log('='.repeat(80));
          console.log('');

          throw new Error(
            `Transaction cost exceeds configured maximum. ` +
            `Estimated cost: ${transactionCostEth.toExponential(4)} ETH (${bufferedGasLimit.toString()} gas × ${gasPriceUsedEth.toExponential(4)} ETH/gas), ` +
            `Maximum allowed: ${maxAllowedCostEth.toExponential(4)} ETH. ` +
            `Please contact support to adjust gas cost limits.`
          );
        }

        console.log(`   Status: ✅ PASSED - Transaction within limits`);
        console.log('='.repeat(80));
        console.log('');
      }

      // MOBILE FIX: Call eth_sendTransaction directly to avoid hanging
      // signer.sendTransaction() hangs on mobile waiting for mining (broken events)
      // Solution: Call eth_sendTransaction via provider.request() for immediate hash
      console.log('[Web3Service.fundAndSendTransaction] Sending transaction via direct eth_sendTransaction...');
      mLog.info('Web3Service', '📤 Calling eth_sendTransaction directly (bypasses hanging on mobile)...');

      // Get user address (using getUserAddress instead of signer.getAddress to avoid getSigner call)
      const fromAddress = await this.getUserAddress();

      // Call eth_sendTransaction directly via provider
      const provider = this.provider as any;

      // CRITICAL: Query nonce BEFORE sending transaction using RPC ONLY (no wallet popup)
      // We MUST know the exact nonce to verify the transaction later
      mLog.info('Web3Service', '🔢 Querying nonce from RPC (no wallet access)...');

      console.log(`📡 Querying nonce from RPC (${this.config.rpcUrl})...`);
      let nonce: number;
      try {
        const nonceResponse = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [fromAddress, 'pending'],
            id: Date.now()
          })
        });
        const rpcData = await nonceResponse.json();
        if (rpcData.result) {
          nonce = parseInt(rpcData.result, 16);
          console.log(`   ✅ RPC returned nonce: ${nonce} (0x${nonce.toString(16)})`);
        } else {
          throw new Error('RPC nonce query failed');
        }
      } catch (error) {
        console.error('   ❌ RPC nonce query failed:', error);
        throw new Error('Failed to query nonce from RPC');
      }

      mLog.info('Web3Service', `✅ Using nonce: ${nonce} (0x${nonce.toString(16)})`, {
        fromAddress,
        nonce,
        source: 'RPC only (no wallet access)'
      });

      // Format transaction for eth_sendTransaction RPC call
      // IMPORTANT: Include the nonce we just queried so we know exactly what nonce is used
      const rpcTxParams: any = {
        from: fromAddress,
        to: tx.to,
        data: tx.data,
        value: this.formatValueForRpc(tx.value || '0x0'),
        nonce: `0x${nonce.toString(16)}` // ✅ Include nonce for hash consistency
      };

      // Add gas parameters if available
      if (tx.gasLimit) {
        rpcTxParams.gas = `0x${tx.gasLimit.toString(16)}`;
      }
      if (tx.maxFeePerGas) {
        rpcTxParams.maxFeePerGas = `0x${tx.maxFeePerGas.toString(16)}`;
      }
      if (tx.maxPriorityFeePerGas) {
        rpcTxParams.maxPriorityFeePerGas = `0x${tx.maxPriorityFeePerGas.toString(16)}`;
      }

      mLog.info('Web3Service', '📋 Transaction params:', {
        from: rpcTxParams.from,
        to: rpcTxParams.to,
        value: rpcTxParams.value,
        nonce: rpcTxParams.nonce,
        gas: rpcTxParams.gas,
        maxFeePerGas: rpcTxParams.maxFeePerGas,
        maxPriorityFeePerGas: rpcTxParams.maxPriorityFeePerGas,
        dataLength: tx.data?.length || 0
      });

      let returnedHash: string;

      if (provider.request && typeof provider.request === 'function') {
        // EIP-1193 interface
        mLog.info('Web3Service', '🔄 Calling provider.request({ method: eth_sendTransaction })...');
        returnedHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [rpcTxParams]
        });
      } else if (provider.send && typeof provider.send === 'function') {
        // ethers JsonRpcProvider interface
        mLog.info('Web3Service', '🔄 Calling provider.send(eth_sendTransaction)...');
        returnedHash = await provider.send('eth_sendTransaction', [rpcTxParams]);
      } else {
        throw new Error('Provider does not support request() or send() methods');
      }

      mLog.info('Web3Service', `📥 eth_sendTransaction returned: ${returnedHash}`);
      console.log('📥 eth_sendTransaction returned hash:', returnedHash);

      // NETWORK VALIDATION FIX (v38.2.4): Hash is now reliable because wallet is on correct network
      // Previous issue: Wallet on Ethereum (chain 1) → wrong hash returned
      // Now: Network validation ensures wallet on Base (chain 8453) → correct hash returned

      // Wait for transaction confirmation (lightweight check)
      // On Base, blocks are ~2 seconds, so a few quick checks should catch it
      // If network is broken (post app-switch), we'll fail fast and return hash anyway
      mLog.info('Web3Service', '⏳ Waiting for transaction confirmation...');

      try {
        // Quick confirmation check: 3 attempts over 6 seconds
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

          try {
            // Use READ-ONLY RPC for transaction receipt (prevents wallet popups)
            const receipt = await this.readProvider?.getTransactionReceipt(returnedHash);
            if (receipt && receipt.blockNumber) {
              mLog.info('Web3Service', '✅ Transaction confirmed!', {
                hash: returnedHash,
                blockNumber: receipt.blockNumber,
                status: receipt.status
              });
              console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

              if (receipt.status === 0) {
                throw new Error('Transaction failed on blockchain (status: 0)');
              }

              return returnedHash;
            }
          } catch (receiptError) {
            // Ignore individual receipt check failures, keep trying
            mLog.debug('Web3Service', `Receipt check ${i + 1} failed, retrying...`);
          }
        }

        // Receipt not found after 3 attempts - transaction still pending
        // Return hash anyway, it's been submitted and will mine eventually
        mLog.warn('Web3Service', '⚠️ Transaction confirmation timeout - returning hash (transaction will mine eventually)', {
          hash: returnedHash
        });
        console.log('⚠️ Transaction submitted but not yet confirmed:', returnedHash);

        return returnedHash;

      } catch (confirmError) {
        // Network broken - return hash anyway, transaction was submitted
        mLog.warn('Web3Service', '⚠️ Confirmation check failed (network issue) - returning hash', {
          hash: returnedHash,
          error: confirmError instanceof Error ? confirmError.message : String(confirmError)
        });
        console.log('⚠️ Could not verify confirmation, but transaction was submitted:', returnedHash);

        return returnedHash;
      }

    } catch (error) {
      console.error('[Web3Service.fundAndSendTransaction] Failed to send via ethers, error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find transaction hash by searching blockchain for (address, nonce) match
   *
   * Problem: On mobile, eth_sendTransaction() returns WRONG hash (someone else's transaction!)
   * Solution: IGNORE returned hash completely. Search blockchain for transaction matching
   *           (userAddress, nonce) and retry until found.
   *
   * @param fromAddress - User's wallet address
   * @param nonce - Transaction nonce that was used
   * @param maxAttempts - Maximum number of search attempts (default: 30)
   * @param delayMs - Delay between attempts in milliseconds (default: 2000)
   * @param maxBlocksToSearch - How many recent blocks to search (default: 20)
   * @returns Correct transaction hash found on blockchain
   * @throws Error if transaction not found after all attempts
   */
  private async findTransactionByNonce(
    fromAddress: string,
    nonce: number,
    maxAttempts: number = 30,
    delayMs: number = 2000,
    maxBlocksToSearch: number = 20
  ): Promise<string> {

    mLog.info('Web3Service', '🔍 Searching for transaction by address + nonce...', {
      fromAddress,
      nonce,
      maxAttempts,
      delayMs,
      maxBlocksToSearch
    });

    const provider = this.provider as any;
    if (!provider || !provider.send) {
      throw new Error('No provider available for transaction search');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Get latest block number
        const latestBlockHex = await provider.send('eth_blockNumber', []);
        const latestBlockNum = parseInt(latestBlockHex, 16);

        mLog.info('Web3Service', `🔍 Search attempt ${attempt}/${maxAttempts} - Latest block: ${latestBlockNum}`);

        // Search recent blocks for the transaction
        for (let i = 0; i < maxBlocksToSearch; i++) {
          const blockNum = latestBlockNum - i;
          if (blockNum < 0) break;

          const blockHex = `0x${blockNum.toString(16)}`;
          const blockData = await provider.send('eth_getBlockByNumber', [blockHex, false]);

          if (!blockData || !blockData.transactions) {
            continue;
          }

          // Search transactions in this block
          for (const txHash of blockData.transactions) {
            const txData = await provider.send('eth_getTransactionByHash', [txHash]);

            if (!txData) continue;

            // Check if this transaction matches our criteria
            const txFrom = txData.from?.toLowerCase();
            const expectedFrom = fromAddress.toLowerCase();
            const txNonce = typeof txData.nonce === 'string' ? parseInt(txData.nonce, 16) : txData.nonce;

            if (txFrom === expectedFrom && txNonce === nonce) {
              mLog.info('Web3Service', '✅ Found transaction by address + nonce!', {
                hash: txData.hash,
                nonce: txNonce,
                block: blockNum,
                attempt: attempt,
                fromAddress: txFrom
              });
              return txData.hash;
            }
          }
        }

        // Not found yet - wait before retrying
        if (attempt < maxAttempts) {
          mLog.info('Web3Service', `⏳ Transaction not found yet, waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        mLog.warn('Web3Service', `Search attempt ${attempt} failed:`, {
          error: error instanceof Error ? error.message : String(error)
        });

        // If not the last attempt, wait and retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // Transaction not found after all attempts
    throw new Error(
      `Transaction not found after ${maxAttempts} attempts (${maxAttempts * delayMs / 1000}s). ` +
      `Searched for transaction from ${fromAddress} with nonce ${nonce}.`
    );
  }

  /**
   * Format value for RPC transaction call
   * Handles string values that could be:
   * - Already hex format: "0x0" or "0xABC..."
   * - Decimal string: "1000000000000000000"
   * - BigInt or number
   */
  private formatValueForRpc(value: string | bigint | number): string {
    // If it's a string that starts with "0x", it's already hex - return as-is
    if (typeof value === 'string' && value.startsWith('0x')) {
      return value;
    }

    // If it's a decimal string or number, convert to BigInt then to hex
    try {
      const bigIntValue = BigInt(value);
      return `0x${bigIntValue.toString(16)}`;
    } catch (error) {
      console.error('[Web3Service.formatValueForRpc] Failed to convert value to hex:', value, error);
      // Fallback to '0x0' if conversion fails
      return '0x0';
    }
  }

  /**
   * Convert gwei to wei using the configured max gas price
   */
  private getMaxGasPriceInWei(): bigint {
    const maxGasPriceGwei = parseFloat(this.config.maxGasPriceGwei);
    return BigInt(Math.round(maxGasPriceGwei * 1000000000)); // Convert gwei to wei
  }

  /**
   * Convert gwei to wei using the configured max gas cost
   */
  private getMaxGasCostInWei(): bigint {
    const maxGasCostGwei = parseFloat(this.config.maxGasCostGwei);
    return BigInt(Math.round(maxGasCostGwei * 1000000000)); // Convert gwei to wei
  }

  /**
   * Detect transaction type from encoded function data to choose appropriate Foundry gas fallback
   */
  private detectTransactionType(data: string): 'depositFunds' | 'approve' | 'transfer' | 'unknown' {
    if (!data || data === '0x') {
      return 'unknown';
    }

    // Function selectors (first 4 bytes of keccak256 hash of function signature)
    const functionSelector = data.slice(0, 10); // '0x' + 8 hex chars = 10 chars total

    // Dynamically calculate function selectors using ethers.js
    try {
      // Define function signatures we want to detect
      const functionSignatures = {
        'depositFunds': 'function depositFunds()',
        'approve': 'function approve(address,uint256)',
        'transfer': 'function transfer(address,uint256)'
      };

      // Calculate selectors dynamically
      for (const [functionName, signature] of Object.entries(functionSignatures)) {
        const iface = new ethers.Interface([signature]);
        const func = iface.getFunction(functionName);
        if (func) {
          const calculatedSelector = func.selector;

          if (functionSelector === calculatedSelector) {
            return functionName as 'depositFunds' | 'approve' | 'transfer';
          }
        }
      }
    } catch (error) {
      console.warn('Error calculating function selectors:', error);
      // Fallback to unknown if selector calculation fails
    }

    return 'unknown';
  }

  /**
   * Get reliable EIP-1559 fee data from our configured RPC endpoint
   */
  private async getReliableEIP1559FeeData(): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    if (!this.config.rpcUrl) {
      throw new Error('No RPC URL configured');
    }

    try {
      // Get current base fee and priority fee from our RPC
      const [gasPriceResponse, priorityFeeResponse] = await Promise.all([
        fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 1
          })
        }),
        fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_maxPriorityFeePerGas',
            params: [],
            id: 2
          })
        })
      ]);

      let baseFee = BigInt(0);
      let priorityFee = BigInt(0);

      if (gasPriceResponse.ok) {
        const gasData = await gasPriceResponse.json();
        if (gasData.result) {
          baseFee = BigInt(gasData.result);
          console.log(`✅ Got base fee from RPC (${this.config.rpcUrl}): ${formatWeiAsEthForLogging(baseFee)}`);
        }
      }

      if (priorityFeeResponse.ok) {
        const priorityData = await priorityFeeResponse.json();
        if (priorityData.result) {
          priorityFee = BigInt(priorityData.result);
          console.log(`✅ Got priority fee from RPC: ${formatWeiAsEthForLogging(priorityFee)}`);
        }
      }

      // Apply configured MAX_GAS_PRICE_GWEI cap
      const maxAllowedGasPrice = this.getMaxGasPriceInWei();

      // Cap both values at configured maximum
      const cappedBaseFee = baseFee > maxAllowedGasPrice ? maxAllowedGasPrice : baseFee;
      const cappedPriorityFee = priorityFee > maxAllowedGasPrice ? maxAllowedGasPrice : priorityFee;

      // For maxFeePerGas, ensure it covers base fee + priority fee, but cap total at configured max
      let maxFeePerGas = cappedBaseFee + cappedPriorityFee;
      if (maxFeePerGas > maxAllowedGasPrice) {
        maxFeePerGas = maxAllowedGasPrice;
      }

      console.log(`🔧 EIP-1559 fees: maxFee=${formatWeiAsEthForLogging(maxFeePerGas)}, priority=${formatWeiAsEthForLogging(cappedPriorityFee)}`);

      return {
        maxFeePerGas,
        maxPriorityFeePerGas: cappedPriorityFee
      };
    } catch (error) {
      console.warn(`Failed to get EIP-1559 fees from RPC (${this.config.rpcUrl}):`, error);

      // Fallback to configured MAX_GAS_PRICE_GWEI
      const fallbackFee = this.getMaxGasPriceInWei();
      console.log(`Using fallback EIP-1559 fees (MAX_GAS_PRICE_GWEI): ${formatWeiAsEthForLogging(fallbackFee)}`);
      return {
        maxFeePerGas: fallbackFee,
        maxPriorityFeePerGas: fallbackFee
      };
    }
  }

  /**
   * Get reliable gas price for current network using configured RPC endpoint
   */
  private async getReliableBaseGasPrice(): Promise<bigint> {
    try {
      // Method 1: Use the configured RPC endpoint from environment
      if (!this.config.rpcUrl) {
        throw new Error('No RPC URL configured');
      }

      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const gasPrice = BigInt(data.result);
          console.log(`✅ Got gas price from configured RPC (${this.config.rpcUrl}): ${formatWeiAsEthForLogging(gasPrice)}`);

          // Use configured MAX_GAS_PRICE_GWEI to cap gas prices
          const maxAllowedGasPrice = this.getMaxGasPriceInWei(); // This reads MAX_GAS_PRICE_GWEI from config

          if (gasPrice <= maxAllowedGasPrice) {
            console.log(`✅ Using actual gas price from RPC: ${formatWeiAsEthForLogging(gasPrice)}`);
            return gasPrice;
          } else {
            const actualGwei = Number(gasPrice) / 1000000000;
            const maxGwei = Number(maxAllowedGasPrice) / 1000000000;
            console.warn(
              `🚨 WARNING: Base network gas price (${actualGwei.toFixed(4)} gwei) exceeds MAX_GAS_PRICE_GWEI (${maxGwei} gwei). ` +
              `Transactions may fail. Consider updating MAX_GAS_PRICE_GWEI to at least ${actualGwei.toFixed(4)} gwei.`
            );
            return maxAllowedGasPrice;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to get gas price from configured RPC (${this.config.rpcUrl}):`, error);
    }

    // Method 2: Fallback to configured MAX_GAS_PRICE_GWEI
    const fallbackGasPrice = this.getMaxGasPriceInWei();
    console.log(`Using fallback gas price (MAX_GAS_PRICE_GWEI): ${formatWeiAsEthForLogging(fallbackGasPrice)}`);
    return fallbackGasPrice;
  }

  /**
   * Sign a message using the unified ethers provider
   * @param message The message to sign
   * @returns The signature
   */
  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log('[Web3Service.signMessage] Signing message via unified ethers provider');
      const signer = await this.provider.getSigner();
      const signature = await signer.signMessage(message);
      console.log('[Web3Service.signMessage] Message signed successfully');
      return signature;
    } catch (error) {
      console.error('[Web3Service.signMessage] Failed to sign message:', error);
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for transaction confirmation using the unified ethers provider
   * @param transactionHash The transaction hash to wait for
   * @param maxWaitTime Maximum wait time in milliseconds (default: 30 seconds)
   * @returns Transaction receipt if confirmed, null if timeout/failed
   */
  async waitForTransaction(transactionHash: string, maxWaitTime: number = 30000, contractId?: string): Promise<any | null> {
    if (!this.readProvider) {
      throw new Error('Read provider not initialized');
    }

    console.log(`[Web3Service.waitForTransaction] Waiting for transaction confirmation: ${transactionHash}`);
    mLog.info('TransactionWait', '⏳ Starting manual polling for transaction confirmation', {
      txHash: transactionHash,
      timeoutMs: maxWaitTime,
      contractId: contractId || 'unknown'
    });

    // MOBILE FIX: Manual polling instead of provider.waitForTransaction()
    // The ethers provider.waitForTransaction() relies on WebSocket events/polling
    // which breaks on mobile after switching apps (MetaMask → Browser).
    // We manually poll eth_getTransactionReceipt via the HybridProvider,
    // which routes to the read provider (reliable RPC, not wallet provider).

    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    let pollCount = 0;

    try {
      while (true) {
        pollCount++;
        const elapsedTime = Date.now() - startTime;

        // Check if we've exceeded the timeout
        if (elapsedTime >= maxWaitTime) {
          const errorMessage = contractId
            ? `Transaction confirmation timed out after ${Math.floor(maxWaitTime / 1000)} seconds. ` +
              `Your transaction may still be processing. Please contact support with:\n` +
              `• Contract ID: ${contractId}\n` +
              `• Transaction: ${transactionHash}`
            : `Transaction confirmation timed out after ${Math.floor(maxWaitTime / 1000)} seconds for ${transactionHash}`;

          mLog.error('TransactionWait', '❌ Transaction confirmation TIMEOUT', {
            txHash: transactionHash,
            contractId: contractId || 'unknown',
            elapsedSeconds: Math.floor(elapsedTime / 1000),
            pollAttempts: pollCount,
            message: 'Transaction did not confirm within timeout period. User should contact support.'
          });

          console.warn(`[Web3Service.waitForTransaction] TIMEOUT after ${pollCount} polls:`, errorMessage);
          throw new Error(errorMessage);
        }

        console.log(`[Web3Service.waitForTransaction] Poll #${pollCount} (${Math.floor(elapsedTime / 1000)}s elapsed)...`);

        try {
          // Manual RPC call for eth_getTransactionReceipt
          // Use read-only RPC provider (no wallet access needed for reading receipts)
          const receipt = await this.readProvider.getTransactionReceipt(transactionHash);

          if (receipt) {
            // Transaction has been mined
            // Note: readProvider.getTransactionReceipt returns status as number (0 or 1), not hex string
            if (receipt.status === 1) {
              console.log(`[Web3Service.waitForTransaction] ✅ Transaction confirmed in block ${receipt.blockNumber}`);
              mLog.info('TransactionWait', '✅ Transaction confirmed successfully', {
                txHash: transactionHash,
                blockNumber: receipt.blockNumber,
                pollAttempts: pollCount,
                elapsedSeconds: Math.floor(elapsedTime / 1000)
              });
              return receipt;
            } else if (receipt.status === 0) {
              console.warn(`[Web3Service.waitForTransaction] ❌ Transaction FAILED (reverted)`);
              mLog.error('TransactionWait', '❌ Transaction failed (reverted)', {
                txHash: transactionHash,
                blockNumber: receipt.blockNumber,
                contractId: contractId || 'unknown'
              });
              throw new Error('Transaction failed');
            } else {
              console.warn(`[Web3Service.waitForTransaction] ⚠️ Unknown transaction status:`, receipt.status);
              mLog.warn('TransactionWait', 'Unknown transaction status', {
                txHash: transactionHash,
                status: receipt.status
              });
              throw new Error('Transaction status unknown');
            }
          }

          // Receipt is null - transaction not yet mined
          console.log(`[Web3Service.waitForTransaction] Transaction not yet mined, waiting ${pollInterval}ms...`);

        } catch (rpcError) {
          // RPC call failed - log but continue polling (might be temporary network issue)
          const errorMsg = rpcError instanceof Error ? rpcError.message : 'Unknown RPC error';
          console.warn(`[Web3Service.waitForTransaction] RPC error during poll #${pollCount}:`, errorMsg);
          mLog.warn('TransactionWait', 'RPC error during polling (will retry)', {
            txHash: transactionHash,
            pollNumber: pollCount,
            error: errorMsg
          });

          // Don't throw - continue polling unless we hit timeout
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Re-throw with context
      if (errorMessage.includes('Transaction failed')) {
        console.warn(`[Web3Service.waitForTransaction] Transaction failed: ${transactionHash}`);
        throw error;
      } else if (errorMessage.includes('timed out')) {
        // Timeout error already has user-friendly message
        throw error;
      } else {
        console.warn(`[Web3Service.waitForTransaction] Unexpected error: ${errorMessage}`);
        mLog.error('TransactionWait', 'Unexpected error during transaction wait', {
          txHash: transactionHash,
          contractId: contractId || 'unknown',
          error: errorMessage
        });
        return null; // Treat unexpected errors as timeout
      }
    }
  }
}