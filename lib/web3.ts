import { ethers } from 'ethers';
import { Config } from '@/types';
import { WalletProvider } from './wallet/types';

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
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initializeProvider(walletProvider: WalletProvider) {
    try {
      this.walletProvider = walletProvider;
      this.provider = walletProvider.getEthersProvider();
    } catch (error) {
      console.error('Failed to initialize ethers provider:', error);
      throw new Error('Provider initialization failed: ' + (error as Error).message);
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
    if (!this.walletProvider || !this.provider) {
      throw new Error('Providers not initialized. Please connect your wallet.');
    }

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
      
      // Fallback to provider's gas price if RPC call fails
      if (!gasPrice) {
        const feeData = await this.provider.getFeeData();
        gasPrice = feeData.gasPrice || BigInt(this.config.minGasWei);
        console.log('Using provider gas price:', gasPrice.toString(), 'wei');
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
    
    // Use the wallet provider abstraction to sign
    return await this.walletProvider.signTransaction({
      from: fromAddress,
      to: txParams.to,
      data: txParams.data,
      value: txParams.value || '0x0',
      gasLimit: `0x${txParams.gasLimit.toString(16)}`,
      gasPrice: `0x${gasPrice.toString(16)}`,
      nonce: nonce,
      chainId: this.config.chainId
    });
  }

  async getSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return await this.provider.getSigner();
  }

  async getUserAddress(): Promise<string> {
    if (!this.walletProvider) {
      throw new Error('Wallet provider not initialized');
    }
    return await this.walletProvider.getAddress();
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

  // Helper method to prepare transaction with gas estimation and pricing
  private async prepareTransactionWithGas(tx: any, gasEstimate: bigint): Promise<any> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    const feeData = await this.provider.getFeeData();
    
    // Set minimum gas price thresholds
    const minGasPrice = this.config.chainId === 43114 
      ? '1000000000'  // 1 nAVAX minimum for mainnet
      : this.config.minGasWei; // Configurable minimum for testnet
    
    const fallbackGasPrice = this.config.chainId === 43114 
      ? '1000000000'  // 1 nAVAX fallback for mainnet
      : '67000000';   // 0.000000067 nAVAX fallback for testnet
    
    // Use network gas price but enforce minimum
    const networkGasPrice = feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : BigInt(0);
    const minGasPriceBigInt = BigInt(minGasPrice);
    const finalGasPrice = networkGasPrice > minGasPriceBigInt 
      ? networkGasPrice.toString()  // Use network price if above minimum
      : (networkGasPrice > BigInt(0) ? minGasPrice : fallbackGasPrice);  // Use minimum or fallback
    
    console.log('Gas calculation:', {
      gasEstimate: `${gasEstimate.toString()} gas`,
      networkGasPrice: `${networkGasPrice.toString()} wei`,
      finalGasPrice: `${finalGasPrice} wei`,
      finalGasPriceInNAVAX: `${(Number(finalGasPrice) / 1e9).toFixed(12)} nAVAX`
    });
    
    return {
      ...tx,
      gasLimit: gasEstimate,
      gasPrice: finalGasPrice,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined
    };
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
    
    // Estimate gas with a proper from address
    const gasEstimate = await this.provider.estimateGas({
      from: userAddress,
      to: params.contractAddress,
      data: txData
    });
    
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
    
    // Estimate gas for AVAX transfer
    const gasEstimate = await this.provider.estimateGas({
      from: userAddress,
      to: to,
      value: value
    });

    // Sign transaction
    const signedTx = await this.signTransaction({
      to: to,
      data: '0x',
      value: `0x${value.toString(16)}`,
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
}