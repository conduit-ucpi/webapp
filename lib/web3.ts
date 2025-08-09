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
  private web3authProvider: any = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initializeProvider(web3authProvider: any) {
    try {
      this.web3authProvider = web3authProvider;
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

  async getUserAddress(): Promise<string> {
    if (!this.web3authProvider) {
      throw new Error('Web3Auth provider not initialized');
    }
    // Get the real wallet address using Web3Auth's request method - this MUST match signing address
    const accounts = await this.web3authProvider.request({
      method: "eth_accounts"
    });
    return accounts[0];
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

  // Sign USDC approval transaction and return hex for chain service
  async signUSDCApproval(amount: string, spenderAddress: string): Promise<string> {
    if (!this.web3authProvider || !this.provider) {
      throw new Error('Providers not initialized');
    }

    const realWalletAddress = await this.getUserAddress();
    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.provider
    );

    const decimals = await usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    // Create transaction data
    const txData = usdcContract.interface.encodeFunctionData('approve', [spenderAddress, amountWei]);
    const gasEstimate = await usdcContract.approve.estimateGas(spenderAddress, amountWei);
    const gasPrice = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(realWalletAddress);
    
    // Create transaction object for Web3Auth signing
    const txObject = {
      from: realWalletAddress,
      to: this.config.usdcContractAddress,
      data: txData,
      value: '0x0',
      gasLimit: `0x${gasEstimate.toString(16)}`,
      gasPrice: `0x${(gasPrice.gasPrice || BigInt('20000000000')).toString(16)}`,
      nonce: `0x${nonce.toString(16)}`
    };
    
    console.log('=== USDC APPROVAL TRANSACTION DEBUG ===');
    console.log('Transaction object for Web3Auth signing:', txObject);
    
    // Sign using Web3Auth provider directly
    const signedTx = await this.web3authProvider.request({
      method: "eth_signTransaction",
      params: [txObject]
    });
    
    console.log('Signed transaction:', signedTx);
    console.log('=== USDC APPROVAL TRANSACTION DEBUG END ===');
    
    return signedTx;
  }

  // Sign deposit funds transaction and return hex for chain service
  async signDepositTransaction(contractAddress: string): Promise<string> {
    if (!this.web3authProvider || !this.provider) {
      throw new Error('Providers not initialized');
    }

    const realWalletAddress = await this.getUserAddress();
    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      this.provider
    );

    // Create transaction data
    const txData = contract.interface.encodeFunctionData('depositFunds', []);
    const gasEstimate = await contract.depositFunds.estimateGas();
    const gasPrice = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(realWalletAddress);
    
    // Create transaction object for Web3Auth signing
    const txObject = {
      from: realWalletAddress,
      to: contractAddress,
      data: txData,
      value: '0x0',
      gasLimit: `0x${gasEstimate.toString(16)}`,
      gasPrice: `0x${(gasPrice.gasPrice || BigInt('20000000000')).toString(16)}`,
      nonce: `0x${nonce.toString(16)}`
    };
    
    console.log('=== DEPOSIT TRANSACTION DEBUG ===');
    console.log('Transaction object for Web3Auth signing:', txObject);
    
    // Sign using Web3Auth provider directly
    const signedTx = await this.web3authProvider.request({
      method: "eth_signTransaction",
      params: [txObject]
    });
    
    console.log('Signed transaction:', signedTx);
    console.log('=== DEPOSIT TRANSACTION DEBUG END ===');
    
    return signedTx;
  }

  // Sign claim funds transaction and return hex for chain service
  async signClaimTransaction(contractAddress: string): Promise<string> {
    if (!this.web3authProvider || !this.provider) {
      throw new Error('Providers not initialized');
    }

    const realWalletAddress = await this.getUserAddress();
    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      this.provider
    );

    // Create transaction data
    const txData = contract.interface.encodeFunctionData('claimFunds', []);
    const gasEstimate = await contract.claimFunds.estimateGas();
    const gasPrice = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(realWalletAddress);
    
    // Create transaction object for Web3Auth signing
    const txObject = {
      from: realWalletAddress,
      to: contractAddress,
      data: txData,
      value: '0x0',
      gasLimit: `0x${gasEstimate.toString(16)}`,
      gasPrice: `0x${(gasPrice.gasPrice || BigInt('20000000000')).toString(16)}`,
      nonce: `0x${nonce.toString(16)}`
    };
    
    console.log('=== CLAIM FUNDS TRANSACTION DEBUG ===');
    console.log('Transaction object for Web3Auth signing:', txObject);
    
    // Sign using Web3Auth provider directly
    const signedTx = await this.web3authProvider.request({
      method: "eth_signTransaction",
      params: [txObject]
    });
    
    console.log('Signed transaction:', signedTx);
    console.log('=== CLAIM FUNDS TRANSACTION DEBUG END ===');
    
    return signedTx;
  }

  // Sign dispute transaction and return hex for chain service
  async signDisputeTransaction(contractAddress: string): Promise<string> {
    if (!this.web3authProvider || !this.provider) {
      throw new Error('Providers not initialized');
    }

    const realWalletAddress = await this.getUserAddress();
    const contract = new ethers.Contract(
      contractAddress,
      ESCROW_CONTRACT_ABI,
      this.provider
    );

    // Create transaction data
    const txData = contract.interface.encodeFunctionData('raiseDispute', []);
    const gasEstimate = await contract.raiseDispute.estimateGas();
    const gasPrice = await this.provider.getFeeData();
    const nonce = await this.provider.getTransactionCount(realWalletAddress);
    
    // Create transaction object for Web3Auth signing
    const txObject = {
      from: realWalletAddress,
      to: contractAddress,
      data: txData,
      value: '0x0',
      gasLimit: `0x${gasEstimate.toString(16)}`,
      gasPrice: `0x${(gasPrice.gasPrice || BigInt('20000000000')).toString(16)}`,
      nonce: `0x${nonce.toString(16)}`
    };
    
    console.log('=== DISPUTE TRANSACTION DEBUG ===');
    console.log('Transaction object for Web3Auth signing:', txObject);
    
    // Sign using Web3Auth provider directly
    const signedTx = await this.web3authProvider.request({
      method: "eth_signTransaction",
      params: [txObject]
    });
    
    console.log('Signed transaction:', signedTx);
    console.log('=== DISPUTE TRANSACTION DEBUG END ===');
    
    return signedTx;
  }
}