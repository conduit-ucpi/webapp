import { useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, OPENLOGIN_NETWORK_TYPE } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Global Web3Auth instance
let web3authInstance: Web3Auth | null = null;

// Function to reset Web3Auth instance (called on logout)
export const resetWeb3AuthInstance = () => {
  web3authInstance = null;
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasVisitedBefore, setHasVisitedBefore] = useState(false);

  const initWeb3Auth = async () => {
    if (!config) return null;
    
    // Always create a new instance if we're initializing after logout
    if (web3authInstance) {
      console.log('Web3Auth instance already exists, returning existing instance');
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

    web3authInstance = new Web3Auth({
      clientId: config.web3AuthClientId,
      web3AuthNetwork: config.web3AuthNetwork as OPENLOGIN_NETWORK_TYPE, // Configurable via WEB3AUTH_NETWORK env var
      chainConfig,
      privateKeyProvider,
      uiConfig: {
        mode: 'light',
        loginMethodsOrder: ['google', 'facebook', 'twitter', 'github', 'discord'],
        logoLight: 'https://web3auth.io/images/w3a-L-Favicon-1.svg',
        logoDark: 'https://web3auth.io/images/w3a-L-Favicon-1.svg',
      },
      enableLogging: false,
    });

    try {
      await web3authInstance.initModal();
      console.log('Web3Auth modal initialized successfully');
    } catch (error) {
      console.error('Web3Auth initialization error:', error);
      // If MetaMask error, just log it and continue
      if (!(error as Error).message?.includes('MetaMask')) {
        throw error;
      }
    }
    
    // Restore original ethereum object after initialization
    if (originalEthereum && !isMobile) {
      (window as any).ethereum = originalEthereum;
    }
    
    // Store provider globally for other components
    (window as any).web3auth = web3authInstance;
    
    console.log('Web3Auth instance stored globally');
    return web3authInstance;
  };

  useEffect(() => {
    if (config && !isInitialized) {
      initWeb3Auth()
        .then(() => setIsInitialized(true))
        .catch((error) => {
          console.error('Web3Auth initialization failed:', error);
          // Don't show MetaMask errors to user
          if (!(error as Error).message?.includes('MetaMask')) {
            console.error('Non-MetaMask initialization error:', error);
          }
          setIsInitialized(true); // Still allow the button to be shown
        });
    }
  }, [config, isInitialized]);

  useEffect(() => {
    const visited = localStorage.getItem('conduit-has-visited');
    setHasVisitedBefore(!!visited);
    
    if (!visited) {
      localStorage.setItem('conduit-has-visited', 'true');
    }
  }, []);

  const connectWallet = async () => {
    if (!config) return;

    setIsConnecting(true);
    try {
      // Always reinitialize Web3Auth to ensure modal appears
      // This is important after logout to reset the session
      console.log('Starting wallet connection...');
      web3authInstance = null;
      (window as any).web3auth = null;
      setIsInitialized(false);
      
      const freshInstance = await initWeb3Auth();

      if (!freshInstance) {
        throw new Error('Web3Auth initialization failed');
      }

      console.log('Checking if already connected:', freshInstance.connected);

      // Check if already connected
      if (freshInstance.connected) {
        const web3authProvider = freshInstance.provider;
        if (!web3authProvider) {
          throw new Error('No provider found');
        }

        // Store provider globally for Web3Service
        (window as any).web3authProvider = web3authProvider;

        const user = await freshInstance.getUserInfo();
        const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }

        const walletAddress = accounts[0] as string;
        const idToken = user.idToken;

        if (!idToken) {
          throw new Error('No ID token received');
        }

        await login(idToken, walletAddress, web3authProvider);
        return;
      }

      // Connect if not already connected
      console.log('Attempting to connect Web3Auth...');
      const web3authProvider = await freshInstance.connect();
      if (!web3authProvider) {
        throw new Error('Failed to connect wallet');
      }
      console.log('Web3Auth connected successfully');

      // Store provider globally for Web3Service
      (window as any).web3authProvider = web3authProvider;

      const user = await freshInstance.getUserInfo();
      const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const walletAddress = accounts[0] as string;
      const idToken = user.idToken;

      if (!idToken) {
        throw new Error('No ID token received');
      }

      await login(idToken, walletAddress, web3authProvider);
    } catch (error: any) {
      console.error('Connection failed:', error);
      // More specific error messages
      if (error.message?.includes('MetaMask')) {
        console.warn('MetaMask interference detected, but continuing with Web3Auth');
        // Don't show error to user for MetaMask conflicts - just log
      } else if (error.message?.includes('User closed the modal')) {
        // User cancelled - don't show error
      } else {
        alert(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (!config) {
    return <LoadingSpinner />;
  }

  return (
    <Button 
      onClick={connectWallet} 
      disabled={isConnecting || !isInitialized}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Connecting...
        </>
      ) : !isInitialized ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Initializing...
        </>
      ) : (
        hasVisitedBefore ? 'Welcome Back' : 'Get Started'
      )}
    </Button>
  );
}