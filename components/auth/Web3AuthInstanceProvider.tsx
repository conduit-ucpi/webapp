import { createContext, useContext, useEffect, useState } from 'react';
import { User, Web3AuthInstanceContextType } from '@/types';
import { useConfig } from './ConfigProvider';
import { Web3Auth } from '@web3auth/modal';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { CHAIN_NAMESPACES } from '@web3auth/base';


const Web3AuthInstanceContext = createContext<Web3AuthInstanceContextType | undefined>(undefined);

export function Web3AuthInstanceProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const [web3authInstance, setWeb3authInstance] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initWeb3Auth = async () => {
    if (!config) return null;

    // Only reuse existing instance if it has a connected provider
    if (web3authInstance && web3authInstance.connected && web3authInstance.provider && provider) {
      console.log('Web3Auth instance already exists and connected, returning existing instance');
      setIsLoading(false);
      return web3authInstance;
    }

    console.log('Initializing new Web3Auth instance...');

    // Check if we're on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Disable MetaMask auto-detection by hiding window.ethereum temporarily
    const originalEthereum = (window as any).ethereum;
    if (originalEthereum && !isMobile) {
      (window as any).ethereum = undefined;
    }

    const chainConfig = {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: `0x${config.chainId.toString(16)}`,
      rpcTarget: config.rpcUrl,
      displayName: 'Avalanche Testnet',
      blockExplorer: 'https://testnet.snowtrace.io',
      ticker: 'AVAX',
      tickerName: 'Avalanche',
    };

    const privateKeyProvider = new EthereumPrivateKeyProvider({
      config: { chainConfig },
    });

    const instance = new Web3Auth({
      clientId: config.web3AuthClientId,
      web3AuthNetwork: config.web3AuthNetwork as any, // Configurable via WEB3AUTH_NETWORK env var
      chainConfig,
      privateKeyProvider,
      enableLogging: false,
    });


    try {
      // Add a small delay on mobile to prevent DOM conflicts
      if (isMobile) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await instance.initModal();
      console.log('Web3Auth modal initialized successfully');
    } catch (error) {
      console.error('Web3Auth initialization error:', error);
      // If MetaMask error or DOM error, just log it and continue
      if ((error as Error).message?.includes('MetaMask') ||
        (error as Error).message?.includes('removeChild') ||
        (error as Error).message?.includes('Node')) {
        console.warn('Known initialization issue, continuing:', error);
      } else {
        throw error;
      }
    }

    // Restore original ethereum object after initialization
    if (originalEthereum && !isMobile) {
      (window as any).ethereum = originalEthereum;
    }

    // Store provider globally for other components
    (window as any).web3auth = instance;
    console.log('Web3Auth instance:', instance);
    console.log('Web3Auth instance stored globally');
    console.log('Web3Auth provider:', instance?.provider);
    if (instance.provider) {
      (window as any).web3authProvider = instance.provider;
    }
    setWeb3authInstance(instance);
    setProvider(instance.provider);
    setIsLoading(false);
  };
  // Try to restore provider immediately if it exists
  useEffect(() => {
    initWeb3Auth();
  }, [config]);

  // Periodically check if Web3Auth instance has connected
  useEffect(() => {
    const checkConnection = () => {
      const globalInstance = (window as any).web3auth;
      const globalProvider = (window as any).web3authProvider;
      
      if (globalInstance && globalProvider && globalInstance.connected) {
        // If we have a global instance that's connected but our state doesn't reflect it
        if (!provider || provider !== globalProvider) {
          console.log('Web3AuthInstanceProvider: Detected external connection, updating state');
          setWeb3authInstance(globalInstance);
          setProvider(globalProvider);
        }
      }
    };

    // Check immediately
    checkConnection();
    
    // Then check every 500ms for changes
    const interval = setInterval(checkConnection, 500);
    
    return () => clearInterval(interval);
  }, [provider]);


  const updateProvider = (newProvider: any) => {
    console.log('Web3AuthInstanceProvider: updateProvider called with:', !!newProvider);
    setProvider(newProvider);
    
    // Also update the instance state if it now has a connected provider
    if (web3authInstance) {
      console.log('Web3AuthInstanceProvider: Instance provider updated:', !!web3authInstance.provider);
      // Force a state update by setting the instance again with a new reference
      setWeb3authInstance(web3authInstance);
    }
  };

  const onLogout = async () => {
    setWeb3authInstance(null);
    setProvider(null);
    setIsLoading(true); // Reset loading state to allow reinitialization
    
    // Clear global references
    (window as any).web3auth = null;
    (window as any).web3authProvider = null;
    
    // Reinitialize Web3Auth for next connection
    await initWeb3Auth();
  }

  return (
    <Web3AuthInstanceContext.Provider value={{ isLoading, web3authInstance, web3authProvider: provider, onLogout, updateProvider }}>
      {children}
    </Web3AuthInstanceContext.Provider>
  );
}

export function useWeb3AuthInstance() {
  const context = useContext(Web3AuthInstanceContext);
  if (context === undefined) {
    throw new Error('useWeb3AuthInstance must be used within an Web3AuthInstanceProvider');
  }
  return context;
}