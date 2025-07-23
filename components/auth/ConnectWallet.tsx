import { useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Global Web3Auth instance
let web3authInstance: Web3Auth | null = null;

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const initWeb3Auth = async () => {
    if (!config || web3authInstance) return web3authInstance;

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
      web3AuthNetwork: 'sapphire_devnet', // Using sapphire_devnet for better compatibility
      chainConfig,
      privateKeyProvider,
      uiConfig: {
        mode: 'light',
        loginMethodsOrder: ['google', 'facebook', 'twitter', 'github', 'discord'],
        logoLight: 'https://web3auth.io/images/w3a-L-Favicon-1.svg',
        logoDark: 'https://web3auth.io/images/w3a-L-Favicon-1.svg',
      },
    });

    await web3authInstance.initModal();
    
    // Store provider globally for other components
    (window as any).web3auth = web3authInstance;
    
    return web3authInstance;
  };

  useEffect(() => {
    if (config && !isInitialized) {
      initWeb3Auth()
        .then(() => setIsInitialized(true))
        .catch((error) => {
          console.error('Web3Auth initialization failed:', error);
          setIsInitialized(true); // Still allow the button to be shown
        });
    }
  }, [config, isInitialized]);

  const connectWallet = async () => {
    if (!config) return;

    setIsConnecting(true);
    try {
      // Reinitialize if needed
      if (!web3authInstance) {
        await initWeb3Auth();
      }

      if (!web3authInstance) {
        throw new Error('Web3Auth initialization failed');
      }

      // Check if already connected
      if (web3authInstance.connected) {
        const web3authProvider = web3authInstance.provider;
        if (!web3authProvider) {
          throw new Error('No provider found');
        }

        // Store provider globally for Web3Service
        (window as any).web3authProvider = web3authProvider;

        const user = await web3authInstance.getUserInfo();
        const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }

        const walletAddress = accounts[0] as string;
        const idToken = user.idToken;

        if (!idToken) {
          throw new Error('No ID token received');
        }

        await login(idToken, walletAddress);
        return;
      }

      // Connect if not already connected
      const web3authProvider = await web3authInstance.connect();
      if (!web3authProvider) {
        throw new Error('Failed to connect wallet');
      }

      // Store provider globally for Web3Service
      (window as any).web3authProvider = web3authProvider;

      const user = await web3authInstance.getUserInfo();
      const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const walletAddress = accounts[0] as string;
      const idToken = user.idToken;

      if (!idToken) {
        throw new Error('No ID token received');
      }

      await login(idToken, walletAddress);
    } catch (error: any) {
      console.error('Connection failed:', error);
      // More specific error messages
      if (error.message?.includes('MetaMask')) {
        alert('Please disable MetaMask or other wallet extensions and try again. Web3Auth will provide its own wallet.');
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
      className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Connecting Wallet...
        </>
      ) : !isInitialized ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Initializing...
        </>
      ) : (
        'Connect Wallet'
      )}
    </Button>
  );
}