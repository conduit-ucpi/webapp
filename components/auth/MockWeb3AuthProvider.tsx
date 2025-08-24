import { createContext, useContext } from 'react';
import { Web3AuthInstanceContextType } from '@/types';

const Web3AuthInstanceContext = createContext<Web3AuthInstanceContextType | undefined>(undefined);

/**
 * Mock Web3Auth provider for Farcaster mode
 * Provides the same interface as Web3AuthContextProvider but with disabled/null values
 */
export function MockWeb3AuthProvider({ children }: { children: React.ReactNode }) {
  const mockContext: Web3AuthInstanceContextType = {
    web3authInstance: null,
    web3authProvider: null,
    isLoading: false,
    onLogout: async () => {},
    updateProvider: () => {}
  };

  return (
    <Web3AuthInstanceContext.Provider value={mockContext}>
      {children}
    </Web3AuthInstanceContext.Provider>
  );
}

export function useWeb3AuthInstance() {
  const context = useContext(Web3AuthInstanceContext);
  if (context === undefined) {
    throw new Error('useWeb3AuthInstance must be used within a Web3AuthContextProvider');
  }
  return context;
}