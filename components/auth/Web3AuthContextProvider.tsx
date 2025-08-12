import { createContext, useContext, useEffect, useState } from 'react';
import { User, Web3AuthInstanceContextType } from '@/types';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthDisconnect } from '@web3auth/modal/react';

const Web3AuthInstanceContext = createContext<Web3AuthInstanceContextType | undefined>(undefined);

export function Web3AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { provider, web3Auth } = useWeb3Auth();
  const { isConnected } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const [isLoading, setIsLoading] = useState(false);

  // Store global references for compatibility with existing code
  useEffect(() => {
    if (web3Auth) {
      (window as any).web3auth = web3Auth;
      console.log('Web3Auth instance stored globally via provider pattern');
    }
    if (provider) {
      (window as any).web3authProvider = provider;
      console.log('Web3Auth provider stored globally via provider pattern');
    }
  }, [web3Auth, provider]);

  // Log Web3Auth instance details
  useEffect(() => {
    if (web3Auth) {
      console.log('Web3Auth instance (provider pattern):', web3Auth);
      console.log('Web3Auth connected:', isConnected);
    }
  }, [web3Auth, isConnected]);

  const updateProvider = (newProvider: any) => {
    console.log('Web3AuthContextProvider: updateProvider called (provider pattern manages this automatically)');
  };

  const onLogout = async () => {
    console.log('Web3AuthContextProvider: onLogout called');
    try {
      if (isConnected && disconnect) {
        await disconnect();
      }
    } catch (error) {
      console.error('Error during Web3Auth logout:', error);
    }
  };

  return (
    <Web3AuthInstanceContext.Provider
      value={{
        isLoading,
        web3authInstance: web3Auth,
        web3authProvider: provider,
        onLogout,
        updateProvider,
      }}
    >
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