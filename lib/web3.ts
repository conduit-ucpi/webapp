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
}