import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { WalletProvider as IWalletProvider, WalletContextType, TransactionRequest } from '@/lib/wallet/types';
import { Web3Auth } from '@web3auth/modal';
import { ethers } from 'ethers';

interface UnifiedWalletContextType {
  walletProvider: IWalletProvider | null;
  isConnected: boolean;
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isLoading: boolean;
  provider: 'web3auth' | 'farcaster' | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextType | undefined>(undefined);

/**
 * Farcaster wallet adapter that implements the WalletProvider interface
 */
class FarcasterWalletAdapter implements IWalletProvider {
  private address: string;
  private walletClient: any;
  private signMessageFn: (args: { message: string }) => Promise<string>;

  constructor(address: string, walletClient: any, signMessageFn: any) {
    this.address = address;
    this.walletClient = walletClient;
    this.signMessageFn = signMessageFn;
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    if (!this.walletClient) throw new Error('Wallet client not available');
    
    const tx = {
      account: this.address as `0x${string}`,
      to: params.to as `0x${string}`,
      data: params.data as `0x${string}`,
      value: params.value ? BigInt(params.value) : undefined,
      gas: params.gasLimit ? BigInt(params.gasLimit) : undefined,
      gasPrice: params.gasPrice ? BigInt(params.gasPrice) : undefined,
      nonce: params.nonce ? Number(params.nonce) : undefined,
      chain: params.chainId ? { id: params.chainId } : undefined,
    };

    const hash = await this.walletClient.sendTransaction(tx);
    return hash;
  }

  async signMessage(message: string): Promise<string> {
    const result = await this.signMessageFn({ message });
    return result;
  }

  isConnected(): boolean {
    return !!this.address;
  }

  async getBalance(): Promise<string> {
    // Implementation would go here
    return '0';
  }

  async switchChain(chainId: number): Promise<void> {
    // Implementation would go here
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this.walletClient) throw new Error('Wallet client not available');
    return await this.walletClient.request(args);
  }

  getProviderName(): string {
    return 'Farcaster';
  }

  getEthersProvider(): any {
    // Return ethers provider wrapper for the wallet client
    return this.walletClient;
  }
}

/**
 * Web3Auth wallet adapter
 */
class Web3AuthWalletAdapter implements IWalletProvider {
  private web3auth: Web3Auth | null = null;
  private provider: any = null;

  async init(web3auth: Web3Auth) {
    this.web3auth = web3auth;
    if (web3auth.provider) {
      this.provider = new ethers.providers.Web3Provider(web3auth.provider);
    }
  }

  async getAddress(): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    const signer = this.provider.getSigner();
    return await signer.getAddress();
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    const signer = this.provider.getSigner();
    const tx = await signer.sendTransaction(params);
    return tx.hash;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    const signer = this.provider.getSigner();
    return await signer.signMessage(message);
  }

  isConnected(): boolean {
    return !!this.provider;
  }

  async getBalance(): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    const signer = this.provider.getSigner();
    const balance = await signer.getBalance();
    return balance.toString();
  }

  async switchChain(chainId: number): Promise<void> {
    // Implementation would go here
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this.web3auth?.provider) throw new Error('Web3Auth not initialized');
    return await this.web3auth.provider.request(args);
  }

  getProviderName(): string {
    return 'Web3Auth';
  }

  getEthersProvider(): any {
    return this.provider;
  }
}

/**
 * Unified wallet provider that automatically selects the correct wallet
 * based on the current context (Web3Auth or Farcaster)
 */
export function UnifiedWalletProvider({ children }: { children: React.ReactNode }) {
  const { isInFarcaster, isDetecting } = useFarcaster();
  
  // Farcaster wallet hooks (always called, but may return null)
  const { address: farcasterAddress, isConnected: farcasterConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  
  // State for Web3Auth
  const [web3authInstance, setWeb3authInstance] = useState<Web3Auth | null>(null);
  const [web3authAddress, setWeb3authAddress] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // Create wallet adapter based on context
  const walletProvider = useMemo(() => {
    if (isDetecting) return null;
    
    if (isInFarcaster && farcasterAddress && walletClient && signMessageAsync) {
      // Use Farcaster wallet
      return new FarcasterWalletAdapter(
        farcasterAddress,
        walletClient,
        signMessageAsync
      );
    } else if (!isInFarcaster && web3authInstance?.provider) {
      // Use Web3Auth wallet
      const adapter = new Web3AuthWalletAdapter();
      adapter.init(web3authInstance);
      return adapter;
    }
    
    return null;
  }, [isInFarcaster, isDetecting, farcasterAddress, walletClient, signMessageAsync, web3authInstance]);

  // Determine connection status and address
  const isConnected = isInFarcaster ? farcasterConnected : !!web3authAddress;
  const address = isInFarcaster ? farcasterAddress : web3authAddress;
  const provider = isDetecting ? null : (isInFarcaster ? 'farcaster' : 'web3auth');

  // Connect wallet function
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (isInFarcaster) {
        // In Farcaster, wallet is already connected via wagmi
        console.log('Wallet already connected in Farcaster');
      } else {
        // Initialize and connect Web3Auth
        // This would be implemented based on your Web3Auth setup
        console.log('Connecting Web3Auth wallet...');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet function
  const disconnectWallet = async () => {
    if (isInFarcaster) {
      // In Farcaster, we don't disconnect
      console.log('Cannot disconnect wallet in Farcaster context');
    } else if (web3authInstance) {
      await web3authInstance.logout();
      setWeb3authInstance(null);
      setWeb3authAddress(null);
    }
  };

  const value: UnifiedWalletContextType = {
    walletProvider,
    isConnected,
    address: address || null,
    connectWallet,
    disconnectWallet,
    isLoading: isLoading || isDetecting,
    provider
  };

  return (
    <UnifiedWalletContext.Provider value={value}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}

/**
 * Unified wallet hook that works with any wallet provider
 */
export function useWallet(): UnifiedWalletContextType {
  const context = useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error('useWallet must be used within UnifiedWalletProvider');
  }
  return context;
}