import { useState, useEffect } from 'react';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthUser, useIdentityToken } from '@web3auth/modal/react';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Function to reset Web3Auth instance (called on logout) - now handled by provider
export const resetWeb3AuthInstance = () => {
  console.log('resetWeb3AuthInstance called - handled by React provider');
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const { provider } = useWeb3Auth();
  const { connect, isConnected } = useWeb3AuthConnect();
  const { userInfo } = useWeb3AuthUser();
  const { token: idToken } = useIdentityToken();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasVisitedBefore, setHasVisitedBefore] = useState(false);



  // Check if already connected and auto-login
  useEffect(() => {
    const handleAutoLogin = async () => {
      if (isConnected && provider && idToken) {
        console.log('Already connected, attempting auto-login...');
        try {
          const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          
          if (accounts && accounts.length > 0) {
            const walletAddress = accounts[0];
            await login(idToken, walletAddress, provider);
          }
        } catch (error) {
          console.error('Auto-login failed:', error);
        }
      }
    };

    handleAutoLogin();
  }, [isConnected, provider, idToken]);

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
    setIsConnecting(true);
    
    try {
      console.log('Starting wallet connection with React provider pattern...');
      
      // Use the React provider's connect method
      const web3authProvider = await connect();
      
      if (!web3authProvider) {
        throw new Error('Failed to connect wallet');
      }
      
      console.log('Web3Auth connected successfully via React provider');

      // Store provider globally for Web3Service
      (window as any).web3authProvider = web3authProvider;

      // Get user info and accounts
      const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const walletAddress = accounts[0] as string;
      
      // Wait a moment for idToken to be populated after connection
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!idToken) {
        throw new Error('No ID token received from Web3Auth');
      }

      console.log('Attempting login with userservice...');
      await login(idToken, walletAddress, web3authProvider);
      console.log('Login successful');
      
      // Force a page reload after successful login to ensure all components update properly
      window.location.reload();
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
      disabled={isConnecting || isConnected}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Connecting...
        </>
      ) : isConnected ? (
        'Connected'
      ) : (
        'Get Started'
      )}
    </Button>
  );
}
