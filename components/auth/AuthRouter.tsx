import React, { useState, useEffect } from 'react';
import { useAuth } from './index';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { 
  detectDevice, 
  getBestAuthMethod, 
  getAuthMethodDescription,
  getViableAuthMethods,
  shouldPromptWalletInstall,
  isInIframe,
  DeviceInfo,
  AuthContext,
  AuthMethod 
} from '@/utils/deviceDetection';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import QRCodeModal from '@/components/ui/QRCodeModal';

interface AuthRouterProps {
  compact?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Smart authentication router that automatically selects the best auth method
 * based on device type, wallet availability, and context
 */
export default function AuthRouter({ compact = false, onSuccess, className = '' }: AuthRouterProps) {
  const { connect, connectWithAdapter, isLoading, error, user, hasVisitedBefore } = useAuth();
  const { isInFarcaster } = useFarcaster();
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [recommendedMethod, setRecommendedMethod] = useState<AuthMethod | null>(null);
  const [viableMethods, setViableMethods] = useState<AuthMethod[]>([]);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [localLoading, setLocalLoading] = useState<string | null>(null);
  const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  
  // WalletConnect's own modal will handle the QR code
  // We don't need custom event handling for it
  
  // Detect device and context on mount
  useEffect(() => {
    const device = detectDevice();
    const context: AuthContext = {
      isInIframe: isInIframe(),
      isInFarcaster: isInFarcaster,
      hasExistingSession: !!user,
    };
    
    setDeviceInfo(device);
    setAuthContext(context);
    
    // Determine best auth method
    const bestMethod = getBestAuthMethod(device, context);
    const viable = getViableAuthMethods(device, context);
    
    setRecommendedMethod(bestMethod);
    setViableMethods(viable);
    
    // Auto-connect if returning user with clear preference
    if (hasVisitedBefore() && !user && context.isInFarcaster) {
      // Farcaster users should auto-connect
      handleAuth('farcaster');
    }
  }, [isInFarcaster, user, hasVisitedBefore]);
  
  const handleAuth = async (method: AuthMethod) => {
    try {
      setLocalLoading(method);
      setAuthError(null);
      
      // Route to appropriate auth method
      switch (method) {
        case 'farcaster':
          // Farcaster auth is handled automatically by the provider
          break;
          
        case 'metamask':
          if (connectWithAdapter) {
            await connectWithAdapter('metamask');
          }
          break;
          
        case 'external_wallet':
          if (connectWithAdapter) {
            await connectWithAdapter('external_wallet');
          }
          break;
          
        case 'walletconnect':
          if (connectWithAdapter) {
            await connectWithAdapter('walletconnect');
          }
          break;
          
        case 'google':
        case 'facebook':
          if (connectWithAdapter) {
            await connectWithAdapter('openlogin', method);
          } else {
            await connect(method);
          }
          break;
          
        case 'email':
          if (!email) {
            setShowEmailForm(true);
            setLocalLoading(null);
            return;
          }
          if (connectWithAdapter) {
            await connectWithAdapter('openlogin', email);
          } else {
            await connect(email);
          }
          break;
          
        default:
          throw new Error(`Unknown auth method: ${method}`);
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLocalLoading(null);
    }
  };
  
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await handleAuth('email');
  };
  
  // Loading state
  if (!deviceInfo || !authContext || !recommendedMethod) {
    return (
      <div className={`flex items-center justify-center p-6 ${className}`}>
        <LoadingSpinner size="md" />
      </div>
    );
  }
  
  // Already authenticated
  if (user) {
    return null;
  }
  
  const isAnyLoading = isLoading || localLoading !== null;
  const showInstallPrompt = shouldPromptWalletInstall(deviceInfo);
  
  // Compact mode - single button that auto-selects best method
  if (compact && !showAllOptions) {
    return (
      <div className={`flex flex-col items-center space-y-3 ${className}`}>
        <Button
          onClick={() => {
            // If recommended is social but wallet is available, show options
            if ((recommendedMethod === 'google' || recommendedMethod === 'facebook' || recommendedMethod === 'email') 
                && deviceInfo.hasWallet) {
              setShowAllOptions(true);
            } else {
              handleAuth(recommendedMethod);
            }
          }}
          disabled={isAnyLoading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg"
        >
          {localLoading === recommendedMethod ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Connecting...
            </>
          ) : (
            getAuthMethodDescription(recommendedMethod)
          )}
        </Button>
        
        {viableMethods.length > 1 && (
          <button
            onClick={() => setShowAllOptions(true)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            More options
          </button>
        )}
        
        {authError && (
          <p className="text-sm text-red-600 text-center">{authError}</p>
        )}
      </div>
    );
  }
  
  // Full options view
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Recommended option */}
      {!showAllOptions && (
        <>
          <div className="text-center mb-2">
            <p className="text-sm text-gray-600">Recommended for your device</p>
          </div>
          
          <Button
            onClick={() => handleAuth(recommendedMethod)}
            disabled={isAnyLoading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg"
          >
            {localLoading === recommendedMethod ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Connecting...
              </>
            ) : (
              getAuthMethodDescription(recommendedMethod)
            )}
          </Button>
        </>
      )}
      
      {/* Show all viable options */}
      {(showAllOptions || !compact) && (
        <>
          {showAllOptions && (
            <button
              onClick={() => setShowAllOptions(false)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              ← Back to recommended
            </button>
          )}
          
          <div className="space-y-2">
            {/* Wallet options */}
            {(deviceInfo.hasMetaMask || deviceInfo.walletType === 'metamask' || 
              (deviceInfo.isWalletBrowser && deviceInfo.isMobile && (window as any).ethereum?.isMetaMask)) && (
              <Button
                onClick={() => handleAuth('metamask')}
                disabled={isAnyLoading}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
              >
                {localLoading === 'metamask' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <img src="/metamask-logo.svg" alt="MetaMask" className="w-5 h-5 mr-2" />
                    Connect MetaMask
                  </>
                )}
              </Button>
            )}
            
            {deviceInfo.hasWallet && !deviceInfo.hasMetaMask && deviceInfo.walletType !== 'metamask' && 
             !(deviceInfo.isWalletBrowser && deviceInfo.isMobile && (window as any).ethereum?.isMetaMask) && (
              <Button
                onClick={() => handleAuth('external_wallet')}
                disabled={isAnyLoading}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
              >
                {localLoading === 'external_wallet' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>Connect {deviceInfo.walletType || 'Wallet'}</>
                )}
              </Button>
            )}
            
            {!deviceInfo.isWalletBrowser && (
              <Button
                onClick={() => handleAuth('walletconnect')}
                disabled={isAnyLoading}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
              >
                {localLoading === 'walletconnect' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <img src="/walletconnect-logo.svg" alt="WalletConnect" className="w-5 h-5 mr-2" />
                    {deviceInfo.isMobile ? 'Connect Mobile Wallet' : 'WalletConnect'}
                  </>
                )}
              </Button>
            )}
            
            {/* Social options */}
            <div className="border-t pt-2 mt-3">
              <p className="text-xs text-gray-500 text-center mb-2">Or continue with</p>
              
              <Button
                onClick={() => handleAuth('google')}
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
                    Google
                  </>
                )}
              </Button>
              
              {showEmailForm ? (
                <form onSubmit={handleEmailSubmit} className="mt-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                    disabled={isAnyLoading}
                  />
                  <Button
                    type="submit"
                    disabled={isAnyLoading || !email.trim()}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
                  >
                    {localLoading === 'email' ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      'Send Magic Link'
                    )}
                  </Button>
                </form>
              ) : (
                <Button
                  onClick={() => setShowEmailForm(true)}
                  disabled={isAnyLoading}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
                >
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Install wallet prompt */}
      {showInstallPrompt && showAllOptions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800">
            For the best experience, we recommend installing{' '}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              MetaMask
            </a>
          </p>
        </div>
      )}
      
      {/* Error display */}
      {authError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{authError}</p>
        </div>
      )}
      
      {/* WalletConnect QR Modal */}
      {showQRModal && walletConnectUri && (
        <QRCodeModal
          uri={walletConnectUri}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}