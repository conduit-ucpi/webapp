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
}

export default function ConnectWalletEmbedded({ 
  className = '', 
  compact = false,
  buttonText = 'Get Started',
  buttonClassName = 'bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50',
  useSmartRouting = false
}: ConnectWalletEmbeddedProps) {
  const { config } = useConfig();
  const { user, isLoading: authLoading, disconnect } = useAuth();
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