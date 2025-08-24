import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface FarcasterContextType {
  isInFarcaster: boolean;
  isLoading: boolean;
  farcasterSDK: any | null; // The actual SDK instance if available
}

const FarcasterContext = createContext<FarcasterContextType>({
  isInFarcaster: false,
  isLoading: true,
  farcasterSDK: null,
});

export const useFarcaster = () => {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcaster must be used within a FarcasterDetectionProvider');
  }
  return context;
};

interface FarcasterDetectionProviderProps {
  children: ReactNode;
}

export const FarcasterDetectionProvider: React.FC<FarcasterDetectionProviderProps> = ({ children }) => {
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [farcasterSDK, setFarcasterSDK] = useState<any>(null);

  useEffect(() => {
    const detectFarcaster = async () => {
      try {
        // Multiple detection methods for robustness
        
        // Method 1: Check for Farcaster-specific window properties
        const hasParentFrame = typeof window !== 'undefined' && window.parent !== window;
        const hasReactNativeWebView = typeof window !== 'undefined' && 'ReactNativeWebView' in window;
        
        // Method 2: Check user agent for Farcaster clients
        const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
        const isFarcasterUserAgent = userAgent.includes('Farcaster') || userAgent.includes('Warpcast');
        
        // Method 3: Try to load and test Farcaster SDK
        let sdkAvailable = false;
        let sdk = null;
        
        try {
          const { default: farcasterSDK } = await import('@farcaster/miniapp-sdk');
          
          // Test if SDK can detect mini-app context
          const isInMiniApp = await farcasterSDK.isInMiniApp();
          
          if (isInMiniApp) {
            sdkAvailable = true;
            sdk = farcasterSDK;
          }
        } catch (error) {
          // SDK not available or failed to load
          console.log('Farcaster SDK not available or failed:', error);
        }
        
        // Method 4: Check for specific URL patterns (if Farcaster passes special params)
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const hasFarcasterParam = urlParams?.has('fc_frame') || urlParams?.has('farcaster');
        
        // Determine if we're in Farcaster based on multiple signals
        const inFarcaster = sdkAvailable || 
                           (hasParentFrame && (isFarcasterUserAgent || hasFarcasterParam)) ||
                           hasReactNativeWebView;
        
        console.log('Farcaster detection results:', {
          hasParentFrame,
          hasReactNativeWebView, 
          isFarcasterUserAgent,
          hasFarcasterParam,
          sdkAvailable,
          finalDecision: inFarcaster
        });
        
        setIsInFarcaster(inFarcaster);
        setFarcasterSDK(sdk);
        
      } catch (error) {
        console.error('Error detecting Farcaster context:', error);
        setIsInFarcaster(false);
      } finally {
        setIsLoading(false);
      }
    };

    detectFarcaster();
  }, []);

  const value: FarcasterContextType = {
    isInFarcaster,
    isLoading,
    farcasterSDK,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
};