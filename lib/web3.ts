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

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private walletProvider: WalletProvider | null = null;
  private eip1193Provider: any = null; // Raw EIP-1193 provider
  private config: Config;
  private onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void;
  private isDesktopQRSession: boolean = false;

  constructor(config: Config) {
    this.config = config;
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
   */
  async initializeProvider(walletProvider: WalletProvider) {
    try {
      console.log('[Web3Service] Initializing with WalletProvider abstraction');
      this.walletProvider = walletProvider;
      this.provider = walletProvider.getEthersProvider();
      console.log('[Web3Service] ✅ Provider initialized via WalletProvider');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize ethers provider:', error);
      throw new Error('Provider initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Initialize directly with any EIP-1193 provider
   * This is the new unified path that works with any wallet connection
   */
  async initializeWithEIP1193(eip1193Provider: any) {
    try {
      console.log('[Web3Service] Initializing with EIP-1193 provider');
      console.log('[Web3Service] Provider type:', eip1193Provider.constructor?.name || typeof eip1193Provider);
      
      // Store the raw EIP-1193 provider
      this.eip1193Provider = eip1193Provider;
      
      // Wrap with ethers
      console.log('[Web3Service] Wrapping EIP-1193 provider with ethers.BrowserProvider...');
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
      
      console.log('[Web3Service] ✅ EIP-1193 provider initialized successfully');
    } catch (error) {
      console.error('[Web3Service] ❌ Failed to initialize EIP-1193 provider:', error);
      throw new Error('EIP-1193 provider initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Single centralized method for signing transactions
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
    console.log('[Web3Service.signTransaction] Starting transaction signing...');

    if (!this.provider) {
      throw new Error('Provider not initialized. Please connect your wallet.');
    }

    // If this is a desktop-to-mobile QR session, show the mobile prompt
    if (this.isDesktopQRSession && this.onMobileActionRequired) {
      console.log('[Web3Service] Desktop QR session detected, showing mobile prompt for transaction');
      this.onMobileActionRequired('transaction');
    }
    
    // Check which type of provider we're using
    const usingLegacyProvider = !!this.walletProvider;
    console.log('[Web3Service.signTransaction] Provider type:', usingLegacyProvider ? 'WalletProvider abstraction' : 'Direct EIP-1193');

    // Get the actual wallet address
    const fromAddress = await this.getUserAddress();
    
    // Get nonce if not provided
    const nonce = txParams.nonce ?? await this.provider.getTransactionCount(fromAddress);
    
    // Get gas price if not provided
    let gasPrice = txParams.gasPrice;
    if (!gasPrice) {
      try {
        // Get live gas price directly from RPC to bypass Web3Auth's stale cached prices
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
          const result = await response.json();
          if (result.result) {
            const liveGasPrice = BigInt(result.result);
            console.log('Using live RPC gas price:', liveGasPrice.toString(), 'wei');
            gasPrice = liveGasPrice;
          }
        }
      } catch (error) {
        console.warn('Failed to get live gas price from RPC, falling back to provider:', error);
      }
      
      // Fallback to minimum gas price if RPC call fails (don't use provider's getFeeData as it may include MetaMask's inflated suggestions)
      if (!gasPrice) {
        gasPrice = BigInt(this.config.minGasWei);
        console.log('Using fallback minimum gas price:', gasPrice.toString(), 'wei');
      }
    }
    
    // Use provided gasLimit or throw error (caller should estimate)
    if (!txParams.gasLimit) {
      throw new Error('Gas limit must be provided');
    }
    
    console.log('Signing transaction:', {
      from: fromAddress,
      to: txParams.to,
      value: txParams.value || '0x0',
      gasLimit: txParams.gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      nonce: nonce
    });
    
    // Sign the transaction based on provider type
    if (this.walletProvider) {
      console.log('[Web3Service.signTransaction] Using WalletProvider.signTransaction()');
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
    } else {
      // Direct EIP-1193 signing via ethers signer
      console.log('[Web3Service.signTransaction] Using ethers signer for EIP-1193 provider');
      const signer = await this.provider.getSigner();
      
      const tx = {
        from: fromAddress,
        to: txParams.to,
        data: txParams.data,
        value: txParams.value || '0x0',
        gasLimit: txParams.gasLimit,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: this.config.chainId
      };
      
      console.log('[Web3Service.signTransaction] Transaction to sign:', tx);
      
      // Sign the transaction using ethers signer (works with any EIP-1193 provider)
      const signedTx = await signer.signTransaction(tx);
      console.log('[Web3Service.signTransaction] ✅ Transaction signed successfully');
      return signedTx;
    }
  }

  async getSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return await this.provider.getSigner();
  }

  async getUserAddress(): Promise<string> {
    // If using WalletProvider abstraction
    if (this.walletProvider) {
      console.log('[Web3Service.getUserAddress] Using WalletProvider abstraction');
      return await this.walletProvider.getAddress();
    }
    
    // If using direct EIP-1193 provider
    if (this.provider) {
      console.log('[Web3Service.getUserAddress] Using EIP-1193 provider via ethers');
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      console.log('[Web3Service.getUserAddress] Got address:', address);
      return address;
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
    
    console.log('getUSDCBalance - raw balance:', balance.toString());
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
          console.log('Using live RPC gas estimate:', gasEstimate.toString(), 'gas');
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
      console.log('Gas estimate:', gasEstimate.toString());
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
          console.log('Using live RPC gas estimate for AVAX transfer:', gasEstimate.toString(), 'gas');
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
   * 1. Estimates gas for the transaction
   * 2. Calls chainservice to fund wallet with estimated gas + 20%
   * 3. Sends the transaction via RPC once wallet is funded
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

    const userAddress = await this.getUserAddress();
    
    // Step 1: Estimate gas
    let gasEstimate: bigint = BigInt(0); // Initialize to avoid TypeScript errors
    if (txParams.gasLimit) {
      gasEstimate = txParams.gasLimit;
      console.log('Using provided gas limit:', gasEstimate.toString());
    } else {
      // Try provider estimation first since it's more reliable
      let estimationSuccess = false;
      const maxRetries = 2; // Reduced retries since provider usually works

      // Try provider estimation first (more reliable)
      for (let attempt = 1; attempt <= maxRetries && !estimationSuccess; attempt++) {
        try {
          console.log(`Estimating gas via provider (attempt ${attempt}/${maxRetries})...`);
          gasEstimate = await this.provider.estimateGas({
            from: userAddress,
            to: txParams.to,
            data: txParams.data,
            value: txParams.value || '0x0'
          });
          console.log('Gas estimate successful:', gasEstimate.toString(), 'gas');
          estimationSuccess = true;
        } catch (providerError: any) {
          // Only log detailed error on last attempt
          if (attempt === maxRetries) {
            console.warn('Provider gas estimation failed:', providerError.message || providerError);
          }
          if (attempt < maxRetries) {
            // Shorter wait before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // If provider failed, try direct RPC as backup (usually less reliable)
      if (!estimationSuccess) {
        console.log('Trying direct RPC estimation as fallback...');

        try {
          // Create timeout for older browsers that don't support AbortSignal.timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(this.config.rpcUrl, {
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
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();
            if (result.result) {
              gasEstimate = BigInt(result.result);
              console.log('Using RPC gas estimate:', gasEstimate.toString(), 'gas');
              estimationSuccess = true;
            }
          }
        } catch (error) {
          // Silently fail RPC, we'll use fallback
        }
      }

      // Final fallback if both methods failed
      if (!estimationSuccess) {
        console.error('All gas estimation attempts failed, using fallback');
        gasEstimate = BigInt(100000); // 100k gas units - reasonable for most transactions
        console.warn('Using fallback gas estimate:', gasEstimate.toString(), 'gas');
      }
    }
    
    // Get gas price
    let gasPrice = txParams.gasPrice;
    if (!gasPrice) {
      try {
        // Get live gas price from RPC
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
          const result = await response.json();
          if (result.result) {
            gasPrice = BigInt(result.result);
            console.log('Using live RPC gas price:', gasPrice.toString(), 'wei');
          }
        }
      } catch (error) {
        console.warn('Failed to get live gas price from RPC:', error);
      }
      
      if (!gasPrice) {
        gasPrice = BigInt(this.config.minGasWei);
        console.log('Using fallback minimum gas price:', gasPrice.toString(), 'wei');
      }
    }
    
    // Step 2: Calculate total gas needed (with 20% buffer)
    const totalGasNeeded = (gasEstimate * gasPrice * BigInt(120)) / BigInt(100);
    console.log('Gas calculation - Estimate:', gasEstimate.toString(), 'Price:', gasPrice.toString(), 'Total needed:', totalGasNeeded.toString(), 'wei');
    
    // Step 3: Call chainservice to fund wallet
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
    
    // Step 4: Send the transaction via direct provider request (required for WalletConnect v2 compatibility)
    console.log('Sending transaction with funded wallet using direct provider request...');
    
    // Use the EIP-1193 provider directly to ensure proper WalletConnect v2 format
    const providerToUse = this.eip1193Provider || this.walletProvider;
    if (!providerToUse) {
      throw new Error('No EIP-1193 provider available for sending transaction');
    }

    console.log('[Web3Service.fundAndSendTransaction] Using direct provider.request()');

    // Debug provider state before transaction
    try {
      const currentChainId = await providerToUse.request({ method: 'eth_chainId' });
      const accounts = await providerToUse.request({ method: 'eth_accounts' });
      console.log('[Web3Service.fundAndSendTransaction] Provider state - chainId:', currentChainId, 'accounts:', accounts.length);
    } catch (debugError) {
      console.warn('[Web3Service.fundAndSendTransaction] Could not verify provider state:', debugError);
    }

    // Build transaction parameters (without chainId - WalletConnect v2 handles this at request level)
    const txParamsForSending = {
      from: userAddress,
      to: txParams.to,
      data: txParams.data,
      value: txParams.value || '0x0',
      gasLimit: toHexString(gasEstimate),
      gasPrice: toHexString(gasPrice)
    };
    
    console.log('[Web3Service.fundAndSendTransaction] Transaction params:', txParamsForSending);

    console.log('[Web3Service.fundAndSendTransaction] Requesting signature from wallet...');

    // Send via direct provider request (our wrapper will handle WalletConnect v2 format)
    const transactionHash = await providerToUse.request({
      method: 'eth_sendTransaction',
      params: [txParamsForSending]
    });

    console.log('Transaction sent successfully:', transactionHash);
    
    return transactionHash;
  }
}