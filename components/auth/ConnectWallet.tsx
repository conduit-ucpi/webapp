import { useState } from 'react';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ConnectWallet() {
  const { config } = useConfig();
  const { user, isLoading, connect } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    if (isLoading) return;

    setIsConnecting(true);
    
    try {
      // AuthProvider handles ALL Web3Auth interaction internally
      await connect();
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
      setIsConnecting(false);
    }
  };

  if (!config) {
    return <LoadingSpinner />;
  }

  const connecting = isConnecting || isLoading;

  return (
    <Button
      onClick={handleConnectWallet}
      disabled={connecting || !!user}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {connecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Connecting...
        </>
      ) : user ? (
        'Connected'
      ) : (
        'Get Started'
      )}
    </Button>
  );
}