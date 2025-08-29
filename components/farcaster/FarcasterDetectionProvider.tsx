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
  const [isLoading, setIsLoading] = useState(true); // Start true to ensure detection runs
  const [farcasterSDK, setFarcasterSDK] = useState<any>(null);
  const [hasMounted, setHasMounted] = useState(false); // Track if we've mounted on client
  
  // Track when we've mounted to avoid hydration issues
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Emergency fallback - always set loading to false after 2 seconds no matter what
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(emergencyTimeout);
  }, []);

  useEffect(() => {
    // Only run detection after component has mounted to avoid hydration issues
    if (!hasMounted) {
      return;
    }
    
    const detectFarcaster = () => {
      // Ensure we're on client side
      if (typeof window === 'undefined') {
        return;
      }
      
      setIsLoading(true);
      
      try {
        // Multiple detection methods for robustness
        
        // Method 1: Check for Farcaster-specific window properties
        const hasParentFrame = typeof window !== 'undefined' && window.parent !== window;
        const hasReactNativeWebView = typeof window !== 'undefined' && 'ReactNativeWebView' in window;
        
        // Method 2: Check user agent for Farcaster clients
        const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
        const isFarcasterUserAgent = userAgent.includes('Farcaster') || userAgent.includes('Warpcast');
        
        // Method 3: Try to detect Farcaster SDK
        let sdkAvailable = false;
        let sdk = null;
        
        try {
          // Check if Farcaster miniapp SDK is available
          const farcasterSDK = (window as any).__farcaster__;
          if (farcasterSDK) {
            sdkAvailable = true;
            sdk = farcasterSDK;
          }
        } catch (e) {
          // Silently handle SDK check errors
        }
        
        // Method 4: Check for specific URL patterns (if Farcaster passes special params)
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const hasFarcasterParam = urlParams?.has('fc_frame') || urlParams?.has('farcaster');
        
        // Determine if we're in Farcaster based on multiple signals
        const inFarcaster = sdkAvailable || 
                           (hasParentFrame && (isFarcasterUserAgent || hasFarcasterParam)) ||
                           hasReactNativeWebView;
        
        setIsInFarcaster(inFarcaster);
        setFarcasterSDK(sdk);
        
      } catch (error) {
        setIsInFarcaster(false);
      } finally {
        setIsLoading(false);
      }
    };

    detectFarcaster();
  }, [hasMounted]); // Only run when hasMounted changes

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