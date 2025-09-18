import { useState } from 'react';
import { useAuth } from './index';
import { useRouter } from 'next/router';
import { ExternalWalletProvider } from '@/lib/wallet/external-wallet-provider';
import AuthRouter from './AuthRouter';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import QRCodeModal from '@/components/ui/QRCodeModal';

interface EmbeddedAuthUIProps {
  className?: string;
  onSuccess?: () => void;
  compact?: boolean;
  useSmartRouting?: boolean; // Enable smart routing
}

export default function EmbeddedAuthUI({ className = '', onSuccess, compact = false, useSmartRouting = false }: EmbeddedAuthUIProps) {
  const { connect, connectWithAdapter, isLoading, error } = useAuth();
  const router = useRouter();
  const [localLoading, setLocalLoading] = useState<string | null>(null);
  const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [email, setEmail] = useState('');
  
  // Use smart routing if enabled
  if (useSmartRouting) {
    return <AuthRouter compact={compact} onSuccess={onSuccess} className={className} />;
  }

  // Set up WalletConnect URI handler
  if (typeof window !== 'undefined') {
    window.web3authWalletConnectUri = (uri: string) => {
      setWalletConnectUri(uri);
      setShowQRModal(true);
    };
  }

  const handleConnect = async (method: string, userEmail?: string) => {
    try {
      setLocalLoading(method);
      
      if (method === 'google' || method === 'facebook') {
        // Social logins use openlogin adapter with specific login provider
        if (connectWithAdapter) {
          await connectWithAdapter('openlogin', method);
        } else {
          await connect(method);
        }
      } else if (method === 'email') {
        // Email authentication with user-provided email passed as loginHint
        if (connectWithAdapter && userEmail) {
          await connectWithAdapter('openlogin', userEmail); // Pass email directly as loginHint
        } else {
          await connect(method);
        }
      } else if (method === 'metamask') {
        // MetaMask uses its own adapter
        if (connectWithAdapter) {
          await connectWithAdapter('metamask');
        } else {
          await connect();
        }
      } else if (method === 'walletconnect') {
        // WalletConnect uses its own adapter
        if (connectWithAdapter) {
          await connectWithAdapter('walletconnect');
        } else {
          await connect();
        }
      } else if (method === 'external_wallet') {
        // External wallet (MetaMask, etc.) using signature authentication
        await handleExternalWalletConnect();
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setLocalLoading(null);
    }
  };

  const handleExternalWalletConnect = async () => {
    try {
      // Check if external wallet is available
      if (!ExternalWalletProvider.isAvailable()) {
        throw new Error('No external wallet found. Please install MetaMask or another compatible wallet.');
      }

      // Use connectWithAdapter with 'external_wallet' to integrate with existing provider system
      if (connectWithAdapter) {
        await connectWithAdapter('external_wallet');
      } else {
        throw new Error('connectWithAdapter not available');
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('External wallet connection failed:', error);
      throw error;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }
    await handleConnect('email', email);
  };

  const isAnyLoading = isLoading || localLoading !== null;

  if (compact) {
    // Compact view for embedded forms
    return (
      <div className={`flex flex-col space-y-2 ${className}`}>
        <Button
          onClick={() => handleConnect('google')}
          disabled={isAnyLoading}
          className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
        >
          {localLoading === 'google' ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        {!showEmailForm ? (
          <Button
            onClick={() => setShowEmailForm(true)}
            disabled={isAnyLoading}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Continue with Email
            </>
          </Button>
        ) : (
          <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Sign in with Email</h4>
              <button
                onClick={() => setShowEmailForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
                disabled={isAnyLoading}
              />
              <Button
                type="submit"
                disabled={isAnyLoading || !email.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {localLoading === 'email' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Send Magic Link'
                )}
              </Button>
            </form>
          </div>
        )}
        
        {!showWalletOptions ? (
          <button
            onClick={() => setShowWalletOptions(true)}
            disabled={isAnyLoading}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Or connect wallet →
          </button>
        ) : (
          <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Connect Wallet</h4>
              <button
                onClick={() => setShowWalletOptions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => handleConnect('external_wallet')}
                disabled={isAnyLoading}
                className="w-full bg-[#F6851B] hover:bg-[#E2761B] text-white text-sm"
              >
                {localLoading === 'external_wallet' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 318.6 318.6">
                      <style>{`.st6{fill:#F6851B;stroke:#F6851B;}`}</style>
                      <polygon className="st6" points="274.1,35.5 174.6,109.4 193,65.8"/>
                    </svg>
                    MetaMask & External Wallets
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleConnect('metamask')}
                disabled={isAnyLoading}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm"
              >
                {localLoading === 'metamask' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Web3Auth MetaMask'
                )}
              </Button>
            </div>
          </div>
        )}
        
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Full view for dedicated auth pages
  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div className="space-y-3">
        {/* Social Login Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Sign in with</h3>
          
          <Button
            onClick={() => handleConnect('google')}
            disabled={isAnyLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 flex items-center justify-center"
          >
            {localLoading === 'google' ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <Button
            onClick={() => handleConnect('facebook')}
            disabled={isAnyLoading}
            className="w-full bg-[#1877F2] hover:bg-[#1864D9] text-white flex items-center justify-center"
          >
            {localLoading === 'facebook' ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </>
            )}
          </Button>

          {!showEmailForm ? (
            <Button
              onClick={() => setShowEmailForm(true)}
              disabled={isAnyLoading}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center"
            >
              <>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Continue with Email
              </>
            </Button>
          ) : (
            <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Sign in with Email</h4>
                <button
                  onClick={() => setShowEmailForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                  disabled={isAnyLoading}
                />
                <Button
                  type="submit"
                  disabled={isAnyLoading || !email.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {localLoading === 'email' ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Send Magic Link'
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or connect wallet</span>
          </div>
        </div>

        {/* Wallet Options */}
        <div className="space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">External Wallets (Recommended)</h4>
            <Button
              onClick={() => handleConnect('external_wallet')}
              disabled={isAnyLoading}
              className="w-full bg-[#F6851B] hover:bg-[#E2761B] text-white flex items-center justify-center border-2 border-[#F6851B]"
            >
              {localLoading === 'external_wallet' ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 318.6 318.6">
                    <style>{`.st0{fill:#E2761B;stroke:#E2761B;}.st1{fill:#E4761B;stroke:#E4761B;}.st2{fill:#D7C1B3;stroke:#D7C1B3;}.st3{fill:#233447;stroke:#233447;}.st4{fill:#CD6116;stroke:#CD6116;}.st5{fill:#E4751F;stroke:#E4751F;}.st6{fill:#F6851B;stroke:#F6851B;}.st7{fill:#C0AD9E;stroke:#C0AD9E;}.st8{fill:#161616;stroke:#161616;}.st9{fill:#763D16;stroke:#763D16;}`}</style>
                    <polygon className="st0" points="274.1,35.5 174.6,109.4 193,65.8"/>
                    <polygon className="st1" points="44.4,35.5 143.1,110.1 125.6,65.8"/>
                    <polygon className="st1" points="238.3,206.8 211.8,247.4 268.5,263 284.8,207.7"/>
                    <polygon className="st1" points="33.9,207.7 50.1,263 106.8,247.4 80.3,206.8"/>
                    <polygon className="st1" points="103.6,138.2 87.8,162.1 144.1,164.6 142.1,104.1"/>
                    <polygon className="st1" points="214.9,138.2 175.9,103.4 174.6,164.6 230.8,162.1"/>
                    <polygon className="st1" points="106.8,247.4 140.6,230.9 111.4,208.1"/>
                    <polygon className="st1" points="177.9,230.9 211.8,247.4 207.1,208.1"/>
                  </svg>
                  Connect MetaMask & Others
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Connect directly with MetaMask, Trust Wallet, Coinbase Wallet, or any compatible wallet
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Web3Auth Integration</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={() => handleConnect('metamask')}
              disabled={isAnyLoading}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center border border-gray-300"
            >
              {localLoading === 'metamask' ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 318.6 318.6">
                    <style>{`.st0{fill:#E2761B;stroke:#E2761B;}.st1{fill:#E4761B;stroke:#E4761B;}.st2{fill:#D7C1B3;stroke:#D7C1B3;}.st3{fill:#233447;stroke:#233447;}.st4{fill:#CD6116;stroke:#CD6116;}.st5{fill:#E4751F;stroke:#E4751F;}.st6{fill:#F6851B;stroke:#F6851B;}.st7{fill:#C0AD9E;stroke:#C0AD9E;}.st8{fill:#161616;stroke:#161616;}.st9{fill:#763D16;stroke:#763D16;}`}</style>
                    <polygon className="st0" points="274.1,35.5 174.6,109.4 193,65.8"/>
                    <polygon className="st1" points="44.4,35.5 143.1,110.1 125.6,65.8"/>
                    <polygon className="st1" points="238.3,206.8 211.8,247.4 268.5,263 284.8,207.7"/>
                    <polygon className="st1" points="33.9,207.7 50.1,263 106.8,247.4 80.3,206.8"/>
                    <polygon className="st1" points="103.6,138.2 87.8,162.1 144.1,164.6 142.1,104.1"/>
                    <polygon className="st1" points="214.9,138.2 175.9,103.4 174.6,164.6 230.8,162.1"/>
                    <polygon className="st1" points="106.8,247.4 140.6,230.9 111.4,208.1"/>
                    <polygon className="st1" points="177.9,230.9 211.8,247.4 207.1,208.1"/>
                  </svg>
                  Web3Auth MetaMask
                </>
              )}
            </Button>

            <Button
              onClick={() => handleConnect('walletconnect')}
              disabled={isAnyLoading}
              className="w-full bg-[#3B99FC] hover:bg-[#2E7FD3] text-white flex items-center justify-center"
            >
              {localLoading === 'walletconnect' ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 300 185">
                    <path d="M61.439 36.256c48.91-47.888 128.212-47.888 177.123 0l5.886 5.764a6.041 6.041 0 010 8.67l-20.136 19.716a3.179 3.179 0 01-4.428 0l-8.101-7.931c-34.122-33.408-89.444-33.408-123.566 0l-8.675 8.494a3.179 3.179 0 01-4.428 0L54.978 51.253a6.041 6.041 0 010-8.67l6.46-6.327zM280.206 77.03l17.922 17.547a6.041 6.041 0 010 8.67l-80.81 79.122c-2.446 2.394-6.41 2.394-8.856 0l-57.354-56.155a1.59 1.59 0 00-2.214 0l-57.353 56.155c-2.446 2.394-6.411 2.394-8.857 0L2.164 103.247a6.041 6.041 0 010-8.671l17.922-17.547c2.445-2.394 6.41-2.394 8.856 0l57.354 56.155a1.59 1.59 0 002.214 0L146.055 77.30c2.445-2.394 6.41-2.394 8.856 0l57.354 56.155a1.59 1.59 0 002.214 0L271.35 77.30c2.446-2.394 6.411-2.394 8.857 0z"/>
                  </svg>
                  WalletConnect
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* QR Code Modal for WalletConnect */}
      {showQRModal && walletConnectUri && (
        <QRCodeModal
          uri={walletConnectUri}
          onClose={() => {
            setShowQRModal(false);
            setWalletConnectUri(null);
            setLocalLoading(null);
          }}
        />
      )}
    </div>
  );
}