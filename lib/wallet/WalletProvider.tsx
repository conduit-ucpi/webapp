import { createContext, useContext, useState, useCallback } from 'react';
import { WalletProvider as IWalletProvider, WalletContextType } from './types';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletProvider, setWalletProvider] = useState<IWalletProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = useCallback(async (provider: IWalletProvider) => {
    setIsLoading(true);
    try {
      const userAddress = await provider.getAddress();
      setWalletProvider(provider);
      setAddress(userAddress);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    setWalletProvider(null);
    setAddress(null);
  }, []);

  const isConnected = !!walletProvider && walletProvider.isConnected();

  return (
    <WalletContext.Provider value={{
      walletProvider,
      isConnected,
      address,
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