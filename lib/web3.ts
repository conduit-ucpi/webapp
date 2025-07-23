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

// Basic contract factory ABI
export const FACTORY_ABI = [
  'function createEscrowContract(address seller, uint256 amount, uint256 expiryTimestamp, string description) payable returns (address)',
  'function raiseDispute(address contractAddress) external',
  'function claimFunds(address contractAddress) external'
];

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initializeProvider(web3authProvider: any) {
    this.provider = new ethers.BrowserProvider(web3authProvider);
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

  async getUSDCAllowance(userAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      this.provider
    );

    const allowance = await usdcContract.allowance(userAddress, this.config.contractFactoryAddress);
    const decimals = await usdcContract.decimals();
    
    return ethers.formatUnits(allowance, decimals);
  }

  async approveUSDC(amount: string): Promise<string> {
    const signer = await this.getSigner();
    const usdcContract = new ethers.Contract(
      this.config.usdcContractAddress,
      ERC20_ABI,
      signer
    );

    const decimals = await usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await usdcContract.approve(this.config.contractFactoryAddress, amountWei);
    return tx.hash;
  }

  async createContractTransaction(
    sellerAddress: string,
    amount: string,
    expiryTimestamp: number,
    description: string
  ): Promise<string> {
    const signer = await this.getSigner();
    const factoryContract = new ethers.Contract(
      this.config.contractFactoryAddress,
      FACTORY_ABI,
      signer
    );

    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    
    const tx = await factoryContract.createEscrowContract.populateTransaction(
      sellerAddress,
      amountWei,
      expiryTimestamp,
      description
    );

    return await signer.signTransaction(tx);
  }

  async raiseDisputeTransaction(contractAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const factoryContract = new ethers.Contract(
      this.config.contractFactoryAddress,
      FACTORY_ABI,
      signer
    );

    const tx = await factoryContract.raiseDispute.populateTransaction(contractAddress);
    return await signer.signTransaction(tx);
  }

  async claimFundsTransaction(contractAddress: string): Promise<string> {
    const signer = await this.getSigner();
    const factoryContract = new ethers.Contract(
      this.config.contractFactoryAddress,
      FACTORY_ABI,
      signer
    );

    const tx = await factoryContract.claimFunds.populateTransaction(contractAddress);
    return await signer.signTransaction(tx);
  }
}