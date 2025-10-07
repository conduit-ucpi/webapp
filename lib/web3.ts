import { ethers } from 'ethers';
import { Config } from '@/types';
import { WalletProvider } from './wallet/types';
import { toHex, toHexString, ensureHexPrefix } from '@/utils/hexUtils';

// ERC20 ABI for USDC interactions
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
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
  'event FundsDeposited(address buyer, uint256 amount, uint256 timestamp)',
  'event DisputeRaised(uint256 timestamp)',
  'event DisputeResolved(address recipient, uint256 timestamp)',
  'event FundsClaimed(address recipient, uint256 amount, uint256 timestamp)'
];

import { formatWeiAsEthForLogging, formatGweiAsEthForLogging, formatMicroUSDCForLogging } from '@/utils/logging';

export class Web3Service {
  private static instance: Web3Service | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private walletProvider: WalletProvider | null = null;
  private eip1193Provider: any = null; // Raw EIP-1193 provider
  private config: Config;
  private onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void;
  private isDesktopQRSession: boolean = false;
  private isInitialized: boolean = false;

  private constructor(config: Config) {
    this.config = config;
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
    return this.isInitialized && (!!this.provider || !!this.walletProvider);
  }

  /**
   * Clear the singleton instance (for testing or reset)
   */
  static clearInstance(): void {
    console.log('[Web3Service] Clearing singleton instance');
    Web3Service.instance = null;
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
   * Initialize with generic WalletProvider abstraction (legacy)
   * DEPRECATED: Use initializeWithEIP1193 for new unified approach
   */
  async initializeProvider(walletProvider: WalletProvider) {
    try {
      console.log('[Web3Service] Initializing with WalletProvider abstraction (legacy)');
      this.walletProvider = walletProvider;
      this.provider = walletProvider.getEthersProvider();
      this.isInitialized = true;
      console.log('[Web3Service] ✅ Provider initialized via WalletProvider');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize ethers provider:', error);
      this.isInitialized = false;
      throw new Error('Provider initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Initialize with an ethers provider directly
   * Use this when you already have an ethers provider (e.g., from auth system)
   */
  async initializeWithEthersProvider(ethersProvider: ethers.BrowserProvider) {
    try {
      console.log('[Web3Service] Initializing with ethers provider directly');

      // Store the ethers provider directly
      this.provider = ethersProvider;

      // Test the connection by getting network info
      const network = await this.provider.getNetwork();
      console.log('[Web3Service] ✅ Connected to network:', {
        chainId: network.chainId.toString(),
        name: network.name
      });

      // Get the connected address to verify authentication
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      console.log('[Web3Service] ✅ Connected wallet address:', address);

      this.isInitialized = true;
      console.log('[Web3Service] ✅ Ethers provider initialized successfully');
      console.log('[Web3Service] 🎯 All blockchain operations use the unified ethers provider');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize ethers provider:', error);
      this.isInitialized = false;
      throw new Error('Ethers provider initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Initialize directly with any EIP-1193 provider
   * This is the unified path that works consistently across all wallet types
   * FIXED: All operations (balance reading + transactions) now use the same ethers provider
   */
  async initializeWithEIP1193(eip1193Provider: any) {
    try {
      console.log('[Web3Service] Initializing with unified EIP-1193 provider approach');
      console.log('[Web3Service] Provider type:', eip1193Provider.constructor?.name || typeof eip1193Provider);

      // Store the raw EIP-1193 provider (mainly for debugging/logging)
      this.eip1193Provider = eip1193Provider;

      // Create the unified ethers provider that will handle ALL operations
      console.log('[Web3Service] Creating unified ethers.BrowserProvider...');
      this.provider = new ethers.BrowserProvider(eip1193Provider);

      // Test the connection by getting network info
      const network = await this.provider.getNetwork();
      console.log('[Web3Service] ✅ Connected to network:', {
        chainId: network.chainId.toString(),
        name: network.name
      });

      // Get the connected address to verify authentication
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      console.log('[Web3Service] ✅ Connected wallet address:', address);

      this.isInitialized = true;
      console.log('[Web3Service] ✅ Unified ethers provider initialized successfully');
      console.log('[Web3Service] 🎯 Balance reading ✅ + Transaction signing ✅ now use same provider');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize unified provider:', error);
      this.isInitialized = false;
      throw new Error('Unified provider initialization failed: ' + (error as Error).message);
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

    // Get nonce using unified ethers provider
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const nonce = txParams.nonce ?? await this.provider.getTransactionCount(fromAddress);

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
        // Other networks: try provider but analyze the units it's returning
        try {
          const feeData = await this.provider.getFeeData();
          console.log('🔍 DEBUGGING: Raw fee data from provider:', {
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

      // Check if we should use EIP-1559 format
      try {
        const providerFeeData = await this.provider.getFeeData();
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

      console.log('[Web3Service.signTransaction] Signing transaction via unified approach...');

      // Sign the transaction using ethers signer (works with any wallet type)
      const signedTx = await signer.signTransaction(tx);
      console.log('[Web3Service.signTransaction] ✅ Transaction signed successfully via unified provider');
      return signedTx;

    } catch (error) {
      // Legacy fallback for older initialization paths
      if (this.walletProvider) {
        console.log('[Web3Service.signTransaction] Falling back to legacy WalletProvider.signTransaction()');
        return await this.walletProvider.signTransaction({
          from: fromAddress,
          to: txParams.to,
          data: txParams.data,
          value: txParams.value || '0x0',
          gasLimit: toHex(txParams.gasLimit),
          gasPrice: toHex(gasPrice),
          nonce: nonce,
          chainId: this.config.chainId
        });
      }

      console.error('[Web3Service.signTransaction] ❌ Failed with both unified and legacy approaches:', error);
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
    // Use the unified ethers provider approach for all wallet types
    if (this.provider) {
      console.log('[Web3Service.getUserAddress] Using unified ethers provider');
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      console.log('[Web3Service.getUserAddress] Got address:', address);
      return address;
    }

    // Legacy fallback for older initialization paths
    if (this.walletProvider) {
      console.log('[Web3Service.getUserAddress] Using legacy WalletProvider abstraction');
      return await this.walletProvider.getAddress();
    }

    throw new Error('No provider initialized');
  }
  
  /**
   * Generate a signature-based authentication token
   * This is used when external wallets don't provide JWT tokens
   */
  async generateSignatureAuthToken(): Promise<string> {
    if (!this.provider && !this.walletProvider) {
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
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    console.log('getUSDCBalance - checking for address:', userAddress);
    console.log('getUSDCBalance - USDC contract:', this.config.usdcContractAddress);

    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.provider
    );

    const balance = await usdcContract.balanceOf(userAddress);
    const decimals = await usdcContract.decimals();
    
    console.log(`getUSDCBalance - raw balance: ${formatMicroUSDCForLogging(balance)}`);
    console.log('getUSDCBalance - decimals:', decimals);
    const formattedBalance = ethers.formatUnits(balance, decimals);
    console.log('getUSDCBalance - formatted balance:', formattedBalance);
    
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
      console.warn('Failed to get live gas estimate from RPC for AVAX transfer, falling back to provider:', error);
      // Fallback to provider's gas estimation if RPC call fails
      gasEstimate = await this.provider.estimateGas({
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
          foundryGasEstimate = parseInt(this.config.depositFundsFoundryGas);
          console.log(`Using Foundry fallback for depositFunds (DEPOSIT_FUNDS_FOUNDRY_GAS): ${foundryGasEstimate} gas`);
        } else {
          // Default to USDC operations (approve, transfer, etc.)
          foundryGasEstimate = parseInt(this.config.usdcGrantFoundryGas);
          console.log(`Using Foundry fallback for USDC operations (USDC_GRANT_FOUNDRY_GAS): ${foundryGasEstimate} gas`);
        }

        gasEstimate = BigInt(foundryGasEstimate);
      }
    }

    // Step 2: Use reliable gas price sources instead of trusting unknown providers
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
        // Other networks: try provider but analyze the units it's returning
        try {
          const feeData = await this.provider.getFeeData();
          console.log('🔍 DEBUGGING: Raw fee data from provider:', {
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

    // Step 3: Calculate total gas needed (with 20% buffer)
    const totalGasNeeded = (gasEstimate * gasPrice * BigInt(120)) / BigInt(100);
    console.log(`Gas calculation - Estimate: ${gasEstimate.toString()} gas, Price: ${formatWeiAsEthForLogging(gasPrice)}, Total needed: ${formatWeiAsEthForLogging(totalGasNeeded)}`);

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
      // Get the signer from the same ethers provider used for balance reading
      const signer = await this.provider.getSigner();

      // Build transaction object for ethers with Web3Auth compatibility
      let tx: any = {
        to: txParams.to,
        data: txParams.data,
        value: txParams.value || '0x0',
        gasLimit: gasEstimate
      };

      // Check if we should use EIP-1559 format
      try {
        const providerFeeData = await this.provider.getFeeData();
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
          console.log('Using legacy transaction format');
        }
      } catch (error) {
        // Fallback to legacy format
        tx.gasPrice = gasPrice;
        console.log('Fallback to legacy transaction format');
      }

      console.log('[Web3Service.fundAndSendTransaction] Transaction params:', tx);

      // Validate transaction cost against MAX_GAS_COST_GWEI limit
      let transactionCostWei: bigint;
      if (tx.maxFeePerGas) {
        // EIP-1559 transaction
        transactionCostWei = tx.maxFeePerGas * gasEstimate;
      } else if (tx.gasPrice) {
        // Legacy transaction
        transactionCostWei = tx.gasPrice * gasEstimate;
      } else {
        throw new Error('No gas price set for transaction');
      }

      const maxAllowedCostWei = this.getMaxGasCostInWei();

      if (transactionCostWei > maxAllowedCostWei) {
        const actualCostGwei = Number(transactionCostWei) / 1000000000;
        const maxAllowedCostGwei = Number(maxAllowedCostWei) / 1000000000;
        const gasPriceGwei = tx.maxFeePerGas ? Number(tx.maxFeePerGas) / 1000000000 : Number(tx.gasPrice!) / 1000000000;

        throw new Error(
          `Transaction cost exceeds configured maximum. ` +
          `Estimated cost: ${actualCostGwei.toFixed(4)} gwei (${Number(gasEstimate).toLocaleString()} gas × ${gasPriceGwei.toFixed(4)} gwei/gas), ` +
          `Maximum allowed: ${maxAllowedCostGwei.toFixed(4)} gwei. ` +
          `Please contact support to adjust gas cost limits.`
        );
      }

      console.log(`✅ Transaction cost validation passed: ${formatWeiAsEthForLogging(transactionCostWei)} (within ${formatWeiAsEthForLogging(maxAllowedCostWei)} limit)`);
      console.log('[Web3Service.fundAndSendTransaction] Preparing transaction for Web3Auth workaround...');

      // WORKAROUND: Web3Auth's signer.sendTransaction() pre-validates with wrong gas prices
      // Instead, we'll sign the transaction and send it raw to bypass Web3Auth's validation
      try {
        console.log('[RPC DEBUG] Starting direct RPC transaction approach...');

        // First, get the nonce
        console.log('[RPC DEBUG] Fetching nonce for address:', userAddress);
        const nonceResponse = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [userAddress, 'pending'],
            id: 1
          })
        });

        const nonceData = await nonceResponse.json();
        console.log('[RPC DEBUG] Nonce response:', nonceData);

        if (nonceData.error) {
          console.error('[RPC DEBUG] Nonce fetch failed:', nonceData.error);
          throw new Error(`Failed to fetch nonce: ${nonceData.error.message || JSON.stringify(nonceData.error)}`);
        }

        const nonce = nonceData.result ? parseInt(nonceData.result, 16) : 0;
        console.log('[RPC DEBUG] Parsed nonce:', nonce);

        // Add nonce and chainId to transaction
        tx.nonce = nonce;
        tx.chainId = this.config.chainId;

        console.log('[RPC DEBUG] Final transaction object before signing:', {
          to: tx.to,
          data: tx.data,
          value: tx.value?.toString(),
          gasLimit: tx.gasLimit?.toString(),
          maxFeePerGas: tx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
          gasPrice: tx.gasPrice?.toString(),
          nonce: tx.nonce,
          chainId: tx.chainId,
          type: tx.type
        });

        console.log('[Web3Service.fundAndSendTransaction] Signing transaction with nonce:', nonce);

        // Sign the transaction
        const signedTx = await signer.signTransaction(tx);
        console.log('[RPC DEBUG] Transaction signed successfully, raw tx length:', signedTx.length);
        console.log('[RPC DEBUG] Raw signed transaction (first 100 chars):', signedTx.substring(0, 100) + '...');

        // Send the raw signed transaction directly to RPC, bypassing Web3Auth validation
        console.log('[RPC DEBUG] Sending raw transaction to RPC:', this.config.rpcUrl);
        const sendResponse = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_sendRawTransaction',
            params: [signedTx],
            id: 1
          })
        });

        console.log('[RPC DEBUG] RPC response status:', sendResponse.status, sendResponse.statusText);
        const sendResult = await sendResponse.json();
        console.log('[RPC DEBUG] RPC response body:', sendResult);

        if (sendResult.error) {
          console.error('[RPC DEBUG] RPC returned error:', {
            code: sendResult.error.code,
            message: sendResult.error.message,
            data: sendResult.error.data,
            fullError: sendResult.error
          });

          // Special handling for "replacement transaction underpriced"
          if (sendResult.error.message && sendResult.error.message.includes('replacement transaction underpriced')) {
            console.error('[RPC DEBUG] REPLACEMENT TRANSACTION UNDERPRICED ERROR ANALYSIS:');
            console.error('[RPC DEBUG] This error suggests a nonce collision or pending transaction with higher gas');
            console.error('[RPC DEBUG] Current nonce used:', nonce);
            console.error('[RPC DEBUG] Transaction gas price:', tx.maxFeePerGas?.toString() || tx.gasPrice?.toString());
            console.error('[RPC DEBUG] Consider checking for pending transactions with same nonce');

            // Try to get more information about the current state
            try {
              // Check if there's a different nonce we should be using
              const latestNonceResponse = await fetch(this.config.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'eth_getTransactionCount',
                  params: [userAddress, 'latest'],
                  id: 2
                })
              });
              const latestNonceData = await latestNonceResponse.json();
              const latestNonce = latestNonceData.result ? parseInt(latestNonceData.result, 16) : 0;

              console.error('[RPC DEBUG] Nonce comparison:');
              console.error('[RPC DEBUG] - Used nonce (pending):', nonce);
              console.error('[RPC DEBUG] - Latest nonce (latest):', latestNonce);
              console.error('[RPC DEBUG] - Difference:', nonce - latestNonce);

              // Check current gas price on network
              const gasPriceResponse = await fetch(this.config.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'eth_gasPrice',
                  params: [],
                  id: 3
                })
              });
              const gasPriceData = await gasPriceResponse.json();
              const currentNetworkGasPrice = gasPriceData.result ? BigInt(gasPriceData.result) : BigInt(0);
              const currentNetworkGasPriceGwei = Number(currentNetworkGasPrice) / 1000000000;

              console.error('[RPC DEBUG] Gas price comparison:');
              console.error('[RPC DEBUG] - Our transaction gas price:', formatWeiAsEthForLogging(tx.maxFeePerGas || tx.gasPrice || BigInt(0)));
              console.error('[RPC DEBUG] - Current network gas price:', formatWeiAsEthForLogging(currentNetworkGasPrice));
              console.error('[RPC DEBUG] - Our vs Network ratio:', (Number(tx.maxFeePerGas || tx.gasPrice || BigInt(0)) / Number(currentNetworkGasPrice)).toFixed(4));

            } catch (debugError) {
              console.error('[RPC DEBUG] Could not get additional debug info:', debugError);
            }
          }

          throw new Error(`RPC error: ${sendResult.error.message || JSON.stringify(sendResult.error)}`);
        }

        if (!sendResult.result) {
          console.error('[RPC DEBUG] No transaction hash in successful response:', sendResult);
          throw new Error('No transaction hash returned from RPC');
        }

        console.log('✅ Transaction sent successfully via direct RPC (bypassed Web3Auth validation):', sendResult.result);
        return sendResult.result;

      } catch (signError) {
        console.warn('[Web3Service.fundAndSendTransaction] Direct RPC approach failed, falling back to signer.sendTransaction:', signError);

        // Check if this is a gas-related error
        const errorMessage = signError instanceof Error ? signError.message : String(signError);
        if (errorMessage.includes('replacement transaction underpriced') ||
            errorMessage.includes('insufficient funds') ||
            errorMessage.includes('gas too low')) {

          // Get comprehensive gas information for debugging
          const transactionGasPrice = tx.maxFeePerGas || tx.gasPrice || BigInt(0);
          const transactionGasPriceGwei = Number(transactionGasPrice) / 1000000000;
          const maxAllowedPriceGwei = Number(this.getMaxGasPriceInWei()) / 1000000000;
          const maxAllowedCostGwei = Number(this.getMaxGasCostInWei()) / 1000000000;

          // Calculate transaction costs
          const gasLimit = Number(tx.gasLimit || gasEstimate);
          const transactionCostWei = transactionGasPrice * BigInt(gasLimit);
          const transactionCostGwei = Number(transactionCostWei) / 1000000000;

          // Try to get current network gas prices for comparison
          let networkGasPriceGwei = 'unknown';
          let networkCostGwei = 'unknown';
          try {
            if (this.config.rpcUrl) {
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
              const data = await response.json();
              if (data.result) {
                const networkGasPriceWei = BigInt(data.result);
                networkGasPriceGwei = (Number(networkGasPriceWei) / 1000000000).toFixed(4);
                const networkCostWei = networkGasPriceWei * BigInt(gasLimit);
                networkCostGwei = (Number(networkCostWei) / 1000000000).toFixed(4);
              }
            }
          } catch (networkError) {
            // Ignore network errors when getting current prices
          }

          throw new Error(
            `Transaction failed: Base network rejected the transaction due to insufficient gas price.\n\n` +
            `📊 GAS ANALYSIS:\n` +
            `Gas Required: ${gasLimit.toLocaleString()} units\n` +
            `Network Gas Price: ${networkGasPriceGwei} gwei${networkGasPriceGwei !== 'unknown' ? ' (current)' : ''}\n` +
            `Network Gas Cost: ${networkCostGwei} gwei${networkCostGwei !== 'unknown' ? ' (required total)' : ''}\n` +
            `Your Gas Price: ${transactionGasPriceGwei.toFixed(4)} gwei (capped by MAX_GAS_PRICE_GWEI)\n` +
            `Your Gas Cost: ${transactionCostGwei.toFixed(4)} gwei (supplied total)\n\n` +
            `⚙️ YOUR LIMITS:\n` +
            `MAX_GAS_PRICE_GWEI: ${maxAllowedPriceGwei} gwei (per unit)\n` +
            `MAX_GAS_COST_GWEI: ${maxAllowedCostGwei.toFixed(4)} gwei (total transaction)\n\n` +
            `💡 SOLUTION: Increase your MAX_GAS_PRICE_GWEI setting or wait for network gas prices to decrease.`
          );
        }

        // Fallback: Try the normal signer.sendTransaction (might still fail with Web3Auth)
        try {
          const txResponse = await signer.sendTransaction(tx);
          console.log('Transaction sent successfully via ethers provider:', txResponse.hash);
          return txResponse.hash;
        } catch (fallbackError) {
          // Check again for gas-related errors in fallback
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          if (fallbackErrorMessage.includes('insufficient funds for intrinsic transaction cost')) {
            throw new Error(
              `Transaction failed: Insufficient funds for gas. ` +
              `Web3Auth estimates you need more funds to cover gas fees. ` +
              `Try adding more ETH to your wallet or contact support if this persists.`
            );
          }
          throw fallbackError;
        }
      }

    } catch (error) {
      console.error('[Web3Service.fundAndSendTransaction] Failed to send via ethers, error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  async waitForTransaction(transactionHash: string, maxWaitTime: number = 30000): Promise<any | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    console.log(`[Web3Service.waitForTransaction] Waiting for transaction confirmation: ${transactionHash}`);

    try {
      // Wait for the transaction to be mined with a timeout
      const receipt = await Promise.race([
        this.provider.waitForTransaction(transactionHash, 1), // Wait for 1 confirmation
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), maxWaitTime)
        )
      ]);

      if (receipt?.status === 1) {
        console.log(`[Web3Service.waitForTransaction] Transaction confirmed: ${transactionHash}`);
        return receipt;
      } else if (receipt?.status === 0) {
        console.warn(`[Web3Service.waitForTransaction] Transaction failed: ${transactionHash}`);
        throw new Error('Transaction failed');
      } else {
        console.warn(`[Web3Service.waitForTransaction] Transaction status unknown: ${transactionHash}`);
        throw new Error('Transaction failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Transaction confirmation timeout')) {
        console.warn(`[Web3Service.waitForTransaction] Transaction confirmation timed out: ${transactionHash}`);
        return null; // Timeout - return null
      } else if (errorMessage.includes('Transaction failed')) {
        console.warn(`[Web3Service.waitForTransaction] Transaction failed: ${transactionHash}`);
        throw error; // Failed transaction - re-throw the error
      } else {
        console.warn(`[Web3Service.waitForTransaction] Transaction confirmation failed: ${errorMessage}`);
        return null; // Other errors (network issues, etc.) - treat as timeout
      }
    }
  }
}