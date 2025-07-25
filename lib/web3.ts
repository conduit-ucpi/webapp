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
    
    // Sign the transaction and return hex
    const signedTx = await signer.signTransaction(tx);
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
    
    // Sign the transaction and return hex
    const signedTx = await signer.signTransaction(tx);
    return signedTx;
  }
}