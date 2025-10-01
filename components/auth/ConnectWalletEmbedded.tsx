import { useState } from 'react';
import { useConfig } from './ConfigProvider';
import { useAuth } from '.';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import EmbeddedAuthUI from './EmbeddedAuthUI';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

interface ConnectWalletEmbeddedProps {
  className?: string;
  compact?: boolean;
  buttonText?: string;
  buttonClassName?: string;
  useSmartRouting?: boolean; // Enable smart auth routing
  showTwoOptionLayout?: boolean; // Show two-button layout for wallet choices
}

export default function ConnectWalletEmbedded({
  className = '',
  compact = false,
  buttonText = 'Get Started',
  buttonClassName = 'bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50',
  useSmartRouting = false,
  showTwoOptionLayout = false
}: ConnectWalletEmbeddedProps) {
  const { config } = useConfig();
  const { user, isLoading: authLoading, disconnect, connect, connectWithAdapter } = useAuth();
  const { isInFarcaster } = useFarcaster();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // In Farcaster context, wallet is already connected and auth is automatic
  if (isInFarcaster) {
    if (user) {
      return (
        <div className={className}>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Connected as {user.displayName || user.walletAddress?.slice(0, 6) + '...'}
            </span>
            <Button
              onClick={() => disconnect()}
              variant="secondary"
              size="sm"
            >
              Disconnect
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <div className={`flex items-center px-6 py-3 ${className}`}>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          <span className="text-sm text-gray-600">Connecting...</span>
        </div>
      );
    }
  }

  if (!config) {
    return <LoadingSpinner />;
  }

  // If user is connected, show their status
  if (user) {
    return (
      <div className={className}>
        <div className="flex items-center space-x-3">
          {user.profileImageUrl && (
            <img 
              src={user.profileImageUrl} 
              alt={user.displayName || 'Profile'} 
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {user.displayName || user.email || 'Connected'}
            </span>
            <span className="text-xs text-gray-500">
              {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
            </span>
          </div>
          <Button
            onClick={() => disconnect()}
            variant="secondary"
            size="sm"
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // If showTwoOptionLayout is enabled, show two clear buttons
  if (showTwoOptionLayout) {
    const handleWalletConnect = async () => {
      // Always use direct Reown provider for WalletConnect (Web3Auth modal doesn't support it)
      try {
        const { ReownWalletConnectProvider } = await import('./reownWalletConnect');
        const reownProvider = new ReownWalletConnectProvider(config);

        // Initialize (it will check internally if already initialized)
        await reownProvider.initialize();

        // Connect and open the modal
        const result = await reownProvider.connect();

        if (result.success && result.user) {
          console.log('WalletConnect connected:', result.user.walletAddress);
          // Force page refresh to update auth context
          window.location.reload();
        }
      } catch (err) {
        console.error('WalletConnect failed:', err);
      }
    };

    const handleWeb3Auth = async () => {
      // Now that we're using the modal SDK, this will show the Web3Auth modal
      try {
        await connect();
      } catch (err) {
        console.error('Web3Auth modal failed:', err);
      }
    };

    return (
      <div className={`space-y-4 ${className}`}>
        <Button
          onClick={handleWalletConnect}
          disabled={authLoading}
          className="w-full bg-[#3B99FC] hover:bg-[#2E7FD3] text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 318.6 318.6">
            <style>{`.st6{fill:#FFFFFF;stroke:#FFFFFF;}`}</style>
            <polygon className="st6" points="274.1,35.5 174.6,109.4 193,65.8"/>
            <polygon className="st6" points="44.4,35.5 143.1,110.1 125.6,65.8"/>
          </svg>
          I want to connect my wallet
        </Button>

        <Button
          onClick={handleWeb3Auth}
          disabled={authLoading}
          className="w-full bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          I want to use an email-based wallet
        </Button>
      </div>
    );
  }

  // If compact mode, show the embedded auth UI directly
  if (compact) {
    return (
      <EmbeddedAuthUI
        className={className}
        compact={true}
        useSmartRouting={useSmartRouting}
        onSuccess={() => {
          // Auth successful, UI will update automatically
        }}
      />
    );
  }

  // Otherwise show a button that opens a modal with the auth UI
  return (
    <>
      <Button
        onClick={() => setShowAuthModal(true)}
        disabled={authLoading}
        className={buttonClassName}
      >
        {authLoading ? (
          <>
            <LoadingSpinner className="w-4 h-4 mr-2" />
            Connecting...
          </>
        ) : (
          buttonText
        )}
      </Button>

      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Connect Your Account"
        children={
        <EmbeddedAuthUI 
          useSmartRouting={useSmartRouting}
          onSuccess={() => {
            setShowAuthModal(false);
          }}
        />
        }
      />
    </>
  );
}