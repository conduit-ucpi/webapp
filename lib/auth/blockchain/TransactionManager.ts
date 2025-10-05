/**
 * Transaction management utilities
 */

import { ethers } from 'ethers';
import { ProviderWrapper } from './ProviderWrapper';

export interface TransactionOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  receipt?: ethers.TransactionReceipt;
  error?: string;
}

export class TransactionManager {
  private provider: ProviderWrapper;

  constructor(provider: ProviderWrapper) {
    this.provider = provider;
  }

  /**
   * Send a transaction with proper error handling and logging
   */
  async sendTransaction(
    to: string,
    data: string,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    try {
      console.log('🔧 TransactionManager: Sending transaction to:', to);

      const signer = await this.provider.getSigner();
      if (!signer) {
        throw new Error('No signer available');
      }

      const transaction = {
        to,
        data,
        ...options
      };

      // Estimate gas if not provided
      if (!options.gasLimit) {
        try {
          const estimated = await signer.estimateGas(transaction);
          transaction.gasLimit = estimated + (estimated / BigInt(10)); // Add 10% buffer
          console.log('🔧 TransactionManager: Estimated gas:', transaction.gasLimit.toString());
        } catch (gasError) {
          console.warn('🔧 TransactionManager: Gas estimation failed:', gasError);
        }
      }

      const txResponse = await signer.sendTransaction(transaction);
      console.log('🔧 TransactionManager: Transaction sent:', txResponse.hash);

      // Wait for confirmation
      const receipt = await txResponse.wait();
      console.log('🔧 TransactionManager: ✅ Transaction confirmed:', receipt?.hash);

      return {
        success: true,
        hash: txResponse.hash,
        receipt: receipt || undefined
      };

    } catch (error) {
      console.error('🔧 TransactionManager: ❌ Transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  /**
   * Call a contract method (read-only)
   */
  async callContract(
    contractAddress: string,
    abi: any,
    methodName: string,
    params: any[] = []
  ): Promise<any> {
    try {
      const ethersProvider = this.provider.getEthersProvider();
      if (!ethersProvider) {
        throw new Error('No ethers provider available');
      }

      const contract = new ethers.Contract(contractAddress, abi, ethersProvider);
      const result = await contract[methodName](...params);

      console.log(`🔧 TransactionManager: Contract call ${methodName} result:`, result);
      return result;

    } catch (error) {
      console.error(`🔧 TransactionManager: Contract call ${methodName} failed:`, error);
      throw error;
    }
  }

  /**
   * Send a contract transaction (write operation)
   */
  async sendContractTransaction(
    contractAddress: string,
    abi: any,
    methodName: string,
    params: any[] = [],
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    try {
      const signer = await this.provider.getSigner();
      if (!signer) {
        throw new Error('No signer available');
      }

      const contract = new ethers.Contract(contractAddress, abi, signer);

      console.log(`🔧 TransactionManager: Calling contract method ${methodName} with params:`, params);

      // Estimate gas if not provided
      if (!options.gasLimit) {
        try {
          const estimated = await contract[methodName].estimateGas(...params, options);
          options.gasLimit = estimated + (estimated / BigInt(10)); // Add 10% buffer
        } catch (gasError) {
          console.warn('🔧 TransactionManager: Gas estimation failed:', gasError);
        }
      }

      const txResponse = await contract[methodName](...params, options);
      console.log('🔧 TransactionManager: Contract transaction sent:', txResponse.hash);

      const receipt = await txResponse.wait();
      console.log('🔧 TransactionManager: ✅ Contract transaction confirmed:', receipt?.hash);

      return {
        success: true,
        hash: txResponse.hash,
        receipt: receipt || undefined
      };

    } catch (error) {
      console.error(`🔧 TransactionManager: ❌ Contract transaction ${methodName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Contract transaction failed'
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(hash: string): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
    try {
      const ethersProvider = this.provider.getEthersProvider();
      if (!ethersProvider) {
        return 'not_found';
      }

      const receipt = await ethersProvider.getTransactionReceipt(hash);

      if (!receipt) {
        // Check if transaction exists in mempool
        const tx = await ethersProvider.getTransaction(hash);
        return tx ? 'pending' : 'not_found';
      }

      return receipt.status === 1 ? 'confirmed' : 'failed';

    } catch (error) {
      console.error('🔧 TransactionManager: Failed to get transaction status:', error);
      return 'not_found';
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  async waitForTransaction(
    hash: string,
    timeoutMs: number = 60000
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      const ethersProvider = this.provider.getEthersProvider();
      if (!ethersProvider) {
        return null;
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs);
      });

      // Race between transaction confirmation and timeout
      const result = await Promise.race([
        ethersProvider.waitForTransaction(hash),
        timeoutPromise
      ]);

      return result;

    } catch (error) {
      if (error instanceof Error && error.message === 'Transaction timeout') {
        console.warn('🔧 TransactionManager: Transaction timed out:', hash);
      } else {
        console.error('🔧 TransactionManager: Error waiting for transaction:', error);
      }
      return null;
    }
  }
}