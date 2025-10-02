import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';

interface EthersContextType {
  provider: BrowserProvider | null;
  setProvider: (provider: BrowserProvider | null) => void;
  isReady: boolean;
}

const EthersContext = createContext<EthersContextType | null>(null);

export function EthersProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProviderState] = useState<BrowserProvider | null>(null);
  const [isReady, setIsReady] = useState(false);

  const setProvider = (newProvider: BrowserProvider | null) => {
    console.log('🔧 EthersProvider: Setting provider:', !!newProvider);
    setProviderState(newProvider);
    setIsReady(!!newProvider);
  };

  const contextValue: EthersContextType = {
    provider,
    setProvider,
    isReady
  };

  return (
    <EthersContext.Provider value={contextValue}>
      {children}
    </EthersContext.Provider>
  );
}

export function useEthersProvider(): EthersContextType {
  const context = useContext(EthersContext);
  if (!context) {
    throw new Error('useEthersProvider must be used within EthersProvider');
  }
  return context;
}