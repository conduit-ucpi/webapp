import { createContext, useContext, useEffect, useState } from 'react';
import { User, Web3AuthInstanceContextType } from '@/types';
import { useConfig } from './ConfigProvider';
import { Web3Auth } from '@web3auth/modal';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { CHAIN_NAMESPACES, OPENLOGIN_NETWORK_TYPE } from '@web3auth/base';


const Web3AuthInstanceContext = createContext<Web3AuthInstanceContextType | undefined>(undefined);

export function Web3AuthInstanceProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const [web3authInstance, setWeb3authInstance] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initWeb3Auth = async () => {
    if (!config) return null;

    // Always create a new instance if we're initializing after logout
    if (web3authInstance && web3authInstance.provider && provider) {
      console.log('Web3Auth instance already exists, returning existing instance');
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
      web3AuthNetwork: config.web3AuthNetwork as OPENLOGIN_NETWORK_TYPE, // Configurable via WEB3AUTH_NETWORK env var
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


  const onLogout = async () => {
    setWeb3authInstance(null);
    setProvider(null);
  }

  return (
    <Web3AuthInstanceContext.Provider value={{ isLoading, web3authInstance, web3authProvider: provider, onLogout }}>
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