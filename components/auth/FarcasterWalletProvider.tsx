import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import { WalletProvider as IWalletProvider, WalletContextType, TransactionRequest } from '@/lib/wallet/types';
import { ethers } from 'ethers';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Farcaster wallet provider adapter that implements the WalletProvider interface
 * using wagmi hooks
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

    // Sign and send the transaction
    const hash = await this.walletClient.sendTransaction(tx);
    return hash;
  }

  async signMessage(message: string): Promise<string> {
    const result = await this.signMessageFn({ message });
    return result;
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this.walletClient) throw new Error('Wallet client not available');
    return await this.walletClient.request(args);
  }

  isConnected(): boolean {
    return !!this.address && !!this.walletClient;
  }

  getProviderName(): string {
    return 'Farcaster';
  }

  getEthersProvider(): any {
    // Create an ethers provider from the wallet client
    if (!this.walletClient) return null;
    
    // Return the transport's provider if available
    const transport = this.walletClient.transport;
    if (transport && typeof transport === 'object' && 'request' in transport) {
      return new ethers.BrowserProvider(transport);
    }
    
    // Fallback: create a custom provider that wraps the wallet client
    return {
      request: async (args: { method: string; params?: any[] }) => {
        return await this.walletClient.request(args);
      }
    };
  }
}

/**
 * WalletProvider for Farcaster context that uses wagmi hooks
 */
export function FarcasterWalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected: wagmiIsConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const [walletProvider, setWalletProvider] = useState<IWalletProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-connect when wagmi connects
  useEffect(() => {
    if (wagmiIsConnected && address && walletClient && signMessageAsync) {
      const adapter = new FarcasterWalletAdapter(
        address,
        walletClient,
        signMessageAsync
      );
      setWalletProvider(adapter);
    } else {
      setWalletProvider(null);
    }
  }, [wagmiIsConnected, address, walletClient, signMessageAsync]);

  const connectWallet = useCallback(async (provider: IWalletProvider) => {
    // In Farcaster context, wallet is already connected via wagmi
    // This is here for interface compatibility
    setWalletProvider(provider);
  }, []);

  const disconnectWallet = useCallback(async () => {
    // In Farcaster context, disconnection is handled by wagmi
    setWalletProvider(null);
  }, []);

  const isConnected = !!walletProvider && walletProvider.isConnected();

  return (
    <WalletContext.Provider value={{
      walletProvider,
      isConnected,
      address: address || null,
      connectWallet,
      disconnectWallet,
      isLoading
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}