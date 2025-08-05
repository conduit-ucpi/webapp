import { useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, OPENLOGIN_NETWORK_TYPE } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useWeb3AuthInstance } from './Web3AuthInstanceProvider';

// Global Web3Auth instance
let web3authInstance: Web3Auth | null = null;

// Function to reset Web3Auth instance (called on logout)
export const resetWeb3AuthInstance = () => {
  web3authInstance = null;
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const { web3authInstance, isLoading } = useWeb3AuthInstance();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasVisitedBefore, setHasVisitedBefore] = useState(false);



  useEffect(() => {
    let isMounted = true;

    if (!isLoading) {
      setIsInitialized(true);
      return;
    }

    return () => {
      isMounted = false;
    };
  }, [isLoading]);

  useEffect(() => {
    try {
      const visited = localStorage.getItem('conduit-has-visited');
      setHasVisitedBefore(!!visited);

      if (!visited) {
        localStorage.setItem('conduit-has-visited', 'true');
      }
    } catch (error) {
      console.warn('localStorage not available:', error);
      // Fallback to false if localStorage is not available
      setHasVisitedBefore(false);
    }
  }, []);

  const connectWallet = async () => {
    console.log('Connecting wallet...');
    if (isLoading) {
      console.log('Web3Auth instance is loading, skipping connection');
      return;
    }


    setIsConnecting(true);
    try {
      // Always reinitialize Web3Auth to ensure modal appears
      // This is important after logout to reset the session
      console.log('Starting wallet connection...');
      (window as any).web3auth = null;
      setIsInitialized(false);

      const freshInstance = web3authInstance;

      if (!freshInstance) {
        throw new Error('Web3Auth initialization failed');
      }

      console.log('Checking if already connected:', freshInstance.connected);

      // Check if already connected
      if (freshInstance.connected) {
        const web3authProvider = freshInstance.provider;
        console.log('Web3Auth provider:', web3authProvider);
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

        //console.log('Logging in with ID token:', idToken);
        await login(idToken, walletAddress, web3authProvider);
        //console.log('Login successful');
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
        'Get Started'
      )}
    </Button>
  );
}