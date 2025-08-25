import { useState } from 'react';
import { useConfig } from './ConfigProvider';
import { useAuth } from '.';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useAuthContext } from '@/lib/auth/AuthContextProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Function to reset Web3Auth instance (called on logout) - now handled by provider
export const resetWeb3AuthInstance = () => {
  console.log('resetWeb3AuthInstance called - handled by React provider');
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { user, isLoading: authLoading, login } = useAuth();
  const { isInFarcaster } = useFarcaster();

  // Web3Auth-specific context (only available in Web3Auth flow)
  let authContextData: { connectAuth: () => Promise<any>; isConnecting: boolean } | null = null;
  try {
    // This will throw in Farcaster context - that's expected
    authContextData = useAuthContext();
  } catch (error) {
    // Expected in Farcaster context
  }

  const [isConnecting, setIsConnecting] = useState(false);

  // In Farcaster context, wallet is already connected and auth is automatic
  if (isInFarcaster) {
    if (user) {
      return (
        <Button
          disabled={true}
          className="bg-green-500 text-gray-900 px-6 py-3 rounded-lg font-semibold opacity-50"
        >
          Connected
        </Button>
      );
    } else {
      return (
        <div className="flex items-center px-6 py-3">
          <LoadingSpinner className="w-4 h-4 mr-2" />
          <span className="text-sm text-gray-600">Connecting...</span>
        </div>
      );
    }
  }

  // Web3Auth context - handle connection manually
  const handleConnectWallet = async () => {
    if (!authContextData) {
      console.error('No Web3Auth context available');
      return;
    }

    setIsConnecting(true);
    
    try {
      // Use Web3Auth connection flow
      const authResult = await authContextData.connectAuth();
      
      // Login to backend with the result
      await login(authResult.idToken, authResult.walletAddress);
      
      console.log('Web3Auth connection successful');
    } catch (error: any) {
      console.error('Web3Auth connection failed:', error);
      
      if (error.message?.includes('User closed the modal')) {
        // User cancelled - don't show error
      } else {
        alert(`Failed to connect: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (!config) {
    return <LoadingSpinner />;
  }

  // Web3Auth context logic
  const connecting = isConnecting || authLoading || (authContextData?.isConnecting);
  const isUserConnected = !!user;

  return (
    <Button
      onClick={handleConnectWallet}
      disabled={connecting || isUserConnected}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {connecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Connecting...
        </>
      ) : isUserConnected ? (
        'Connected'
      ) : (
        'Get Started'
      )}
    </Button>
  );
}