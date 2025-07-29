import { ethers } from 'ethers';
import { Config } from '@/types';

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
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initializeProvider(web3authProvider: any) {
    try {
      this.provider = new ethers.BrowserProvider(web3authProvider);
    } catch (error) {
      console.error('Failed to initialize ethers provider:', error);
      throw new Error('Provider initialization failed: ' + (error as Error).message);
    }
  }

  async getSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return await this.provider.getSigner();
  }

  async getUSDCBalance(userAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.provider
    );

    const balance = await usdcContract.balanceOf(userAddress);
    const decimals = await usdcContract.decimals();
    
    return ethers.formatUnits(balance, decimals);
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

  async approveUSDC(amount: string, spenderAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      signer
    );

    const decimals = await usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await usdcContract.approve(spenderAddress, amountWei);
    return tx.hash;
  }

  async getUserAddress(): Promise<string> {
    const signer = await this.getSigner();
    return await signer.getAddress();
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

  // Sign USDC approval transaction and return hex for chain service
  async signUSDCApproval(amount: string, spenderAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      signer
    );

    const decimals = await usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    // Create transaction but don't send it
    const tx = await usdcContract.approve.populateTransaction(spenderAddress, amountWei);
    
    // Get current gas price from network
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const feeData = await this.provider.getFeeData();
    
    console.log('=== USDC APPROVAL TRANSACTION DEBUG ===');
    console.log('Original USDC approval transaction:', tx);
    console.log('Network fee data:', {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
    });
    console.log('Gas estimates:', {
      networkGasEstimate: tx.gasLimit ? `${tx.gasLimit.toString()} gas` : 'Not estimated',
      ourGasLimit: '120000 gas',
      note: tx.gasLimit ? `Network estimated ${tx.gasLimit.toString()}, we're setting 120000` : 'Network did not provide gas estimate'
    });
    
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
    const gasPrice = networkGasPrice > minGasPriceBigInt 
      ? networkGasPrice.toString()  // Use network price if above minimum
      : (networkGasPrice > BigInt(0) ? minGasPrice : fallbackGasPrice);  // Use minimum or fallback
    
    console.log('Gas price calculation:', {
      networkGasPrice: `${networkGasPrice.toString()} wei`,
      minGasPrice: `${minGasPrice} wei`,
      finalGasPrice: `${gasPrice} wei`,
      networkGasPriceInNAVAX: `${(Number(networkGasPrice) / 1e9).toFixed(12)} nAVAX`,
      finalGasPriceInNAVAX: `${(Number(gasPrice) / 1e9).toFixed(12)} nAVAX`
    });
    
    // Use network gas price with reasonable gas limit
    const txWithGas = {
      ...tx,
      gasLimit: '120000', // Increased to 120k gas limit for USDC approval
      gasPrice: gasPrice,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined
    };
    
    console.log('Modified USDC approval transaction:', txWithGas);
    console.log('=== USDC APPROVAL TRANSACTION DEBUG END ===');
    
    // Sign the transaction and return hex
    const signedTx = await signer.signTransaction(txWithGas);
    return signedTx;
  }

  // Sign deposit funds transaction and return hex for chain service
  async signDepositTransaction(contractAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      signer
    );

    // Create transaction but don't send it
    const tx = await contract.depositFunds.populateTransaction();
    
    // Get current gas price from network
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const feeData = await this.provider.getFeeData();
    
    console.log('=== DEPOSIT TRANSACTION DEBUG ===');
    console.log('Original transaction from populateTransaction:', tx);
    console.log('Network fee data:', {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
    });
    console.log('Gas estimates:', {
      networkGasEstimate: tx.gasLimit ? `${tx.gasLimit.toString()} gas` : 'Not estimated',
      ourGasLimit: '150000 gas',
      note: tx.gasLimit ? `Network estimated ${tx.gasLimit.toString()}, we're setting 150000` : 'Network did not provide gas estimate'
    });
    
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
    const gasPrice = networkGasPrice > minGasPriceBigInt 
      ? networkGasPrice.toString()  // Use network price if above minimum
      : (networkGasPrice > BigInt(0) ? minGasPrice : fallbackGasPrice);  // Use minimum or fallback
    
    console.log('Gas price calculation:', {
      networkGasPrice: `${networkGasPrice.toString()} wei`,
      minGasPrice: `${minGasPrice} wei`,
      finalGasPrice: `${gasPrice} wei`,
      networkGasPriceInNAVAX: `${(Number(networkGasPrice) / 1e9).toFixed(12)} nAVAX`,
      finalGasPriceInNAVAX: `${(Number(gasPrice) / 1e9).toFixed(12)} nAVAX`
    });
    
    // Use network gas price with reasonable gas limit
    const txWithGas = {
      ...tx,
      gasLimit: '150000', // Increased to 150k gas limit for depositFunds (was failing at 100k)
      gasPrice: gasPrice,
      maxFeePerGas: undefined, // Remove EIP-1559 fields
      maxPriorityFeePerGas: undefined
    };
    
    console.log('Modified deposit transaction:', txWithGas);
    console.log('=== DEPOSIT TRANSACTION DEBUG END ===');
    
    // Sign the transaction and return hex
    const signedTx = await signer.signTransaction(txWithGas);
    return signedTx;
  }

  // Sign claim funds transaction and return hex for chain service
  async signClaimTransaction(contractAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      signer
    );

    // Create transaction but don't send it
    const tx = await contract.claimFunds.populateTransaction();
    
    // Get gas estimation and pricing
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    const feeData = await this.provider.getFeeData();
    const minGasWei = this.config.minGasWei || '5';
    const minGasPriceBigInt = BigInt(minGasWei);
    
    const networkGasPrice = feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : BigInt(0);
    
    const gasPrice = networkGasPrice > minGasPriceBigInt 
      ? networkGasPrice 
      : minGasPriceBigInt;
    
    console.log('Claim Funds Gas Details:', {
      finalGasPrice: `${gasPrice} wei`,
      minGasWei,
      finalGasPriceInNAVAX: `${(Number(gasPrice) / 1e9).toFixed(12)} nAVAX`
    });
    
    // Set gas parameters
    tx.gasPrice = gasPrice;
    tx.gasLimit = await contract.claimFunds.estimateGas();
    
    // Sign the transaction
    const signedTx = await signer.signTransaction(tx);
    console.log('Signed claim transaction:', signedTx);
    
    return signedTx;
  }
}