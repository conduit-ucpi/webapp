import { useState, useEffect } from 'react';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { useAuthContext } from '@/lib/auth/AuthContextProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Function to reset Web3Auth instance (called on logout) - now handled by provider
export const resetWeb3AuthInstance = () => {
  console.log('resetWeb3AuthInstance called - handled by React provider');
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const { connectWallet: connectToWallet } = useWallet();
  const { 
    authProvider, 
    isConnected, 
    isConnecting: authConnecting, 
    connectAuth,
    hasVisitedBefore: providerHasVisited 
  } = useAuthContext();

  const [isConnecting, setIsConnecting] = useState(false);
  const [hasVisitedBefore, setHasVisitedBefore] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{walletAddress: string} | null>(null);

  // Initialize visited state from provider
  useEffect(() => {
    if (authProvider) {
      setHasVisitedBefore(providerHasVisited);
      if (!providerHasVisited) {
        authProvider.markAsVisited();
      }
    }
  }, [authProvider, providerHasVisited]);

  // Check if already connected and auto-login
  useEffect(() => {
    const handleAutoLogin = async () => {
      if (isConnected && authProvider) {
        console.log('Already connected, attempting auto-login...');
        try {
          const authResult = await connectAuth();
          console.log('Auto-login auth result:', authResult);
          
          // Connect to wallet abstraction
          await connectToWallet(authResult.walletProvider);
          
          // Login to backend
          await login(authResult.idToken, authResult.walletAddress);
        } catch (error) {
          console.error('Auto-login failed:', error);
        }
      }
    };

    handleAutoLogin();
  }, [isConnected, authProvider]);

  // Handle pending login when auth completes
  useEffect(() => {
    const handlePendingLogin = async () => {
      if (pendingLogin && authProvider) {
        console.log('Completing pending login...');
        try {
          await login(pendingLogin.walletAddress, pendingLogin.walletAddress);
          console.log('Pending login successful');
          setPendingLogin(null);
          setIsConnecting(false);
        } catch (error) {
          console.error('Pending login failed:', error);
          setPendingLogin(null);
          setIsConnecting(false);
        }
      }
    };

    handlePendingLogin();
  }, [pendingLogin, authProvider]);

  const handleConnectWallet = async () => {
    if (!authProvider) {
      console.error('No auth provider available');
      return;
    }

    console.log(`Connecting with ${authProvider.getProviderName()}...`);
    setIsConnecting(true);
    
    try {
      console.log(`Starting ${authProvider.getProviderName()} connection...`);
      
      // Connect via auth provider
      const authResult = await connectAuth();
      
      console.log('Auth connection result:', authResult);
      
      // Connect to wallet abstraction
      await connectToWallet(authResult.walletProvider);
      
      // Login to backend
      await login(authResult.idToken, authResult.walletAddress);
      
      console.log('Connection successful');
      setIsConnecting(false);
    } catch (error: any) {
      console.error('Connection failed:', error);
      
      // More specific error messages
      if (error.message?.includes('MetaMask')) {
        console.warn('MetaMask interference detected, but continuing');
      } else if (error.message?.includes('User closed the modal')) {
        // User cancelled - don't show error
      } else {
        alert(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
      }
    } finally {
      // Only set isConnecting to false if we're not waiting for a pending login
      if (!pendingLogin) {
        setIsConnecting(false);
      }
    }
  };

  if (!config) {
    return <LoadingSpinner />;
  }

  if (!authProvider) {
    return <div>Loading authentication provider...</div>;
  }

  const connecting = isConnecting || authConnecting;

  return (
    <Button
      onClick={handleConnectWallet}
      disabled={connecting || isConnected}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {connecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          {pendingLogin ? 'Completing login...' : 'Connecting...'}
        </>
      ) : isConnected ? (
        'Connected'
      ) : (
        'Get Started'
      )}
    </Button>
  );
}