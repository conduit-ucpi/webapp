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
  const [isLoading, setIsLoading] = useState(false); // Start false, only set true during detection
  const [farcasterSDK, setFarcasterSDK] = useState<any>(null);
  const [hasMounted, setHasMounted] = useState(false); // Track if we've mounted on client

  // Track when we've mounted to avoid hydration issues
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Emergency fallback - always set loading to false after 2 seconds no matter what
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      console.log('🚨 EMERGENCY: Force setting isLoading to false after 2 seconds');
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(emergencyTimeout);
  }, []);

  useEffect(() => {
    // Only run detection after component has mounted to avoid hydration issues
    if (!hasMounted) return;
    
    const detectFarcaster = () => {
      // Ensure we're on client side
      if (typeof window === 'undefined') {
        console.log('🔍 Server-side render, skipping detection');
        return;
      }
      
      console.log('🔍 Starting SIMPLIFIED Farcaster detection...');
      setIsLoading(true); // Only set loading true when actually detecting
      
      try {
        // Multiple detection methods for robustness
        
        // Method 1: Check for Farcaster-specific window properties
        const hasParentFrame = typeof window !== 'undefined' && window.parent !== window;
        const hasReactNativeWebView = typeof window !== 'undefined' && 'ReactNativeWebView' in window;
        
        console.log('🔍 Method 1 - Window properties:', {
          hasParentFrame,
          hasReactNativeWebView,
          windowExists: typeof window !== 'undefined'
        });
        
        // Method 2: Check user agent for Farcaster clients
        const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
        const isFarcasterUserAgent = userAgent.includes('Farcaster') || userAgent.includes('Warpcast');
        
        console.log('🔍 Method 2 - User Agent:', {
          userAgent: userAgent.substring(0, 100) + '...',
          isFarcasterUserAgent
        });
        
        // Method 3: Skip SDK detection for now to avoid hanging
        let sdkAvailable = false;
        let sdk = null;
        
        console.log('🔍 Method 3 - Skipping SDK detection to avoid hanging');
        
        // Method 4: Check for specific URL patterns (if Farcaster passes special params)
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const hasFarcasterParam = urlParams?.has('fc_frame') || urlParams?.has('farcaster');
        
        console.log('🔍 Method 4 - URL parameters:', {
          currentURL: typeof window !== 'undefined' ? window.location.href : 'N/A',
          searchParams: urlParams?.toString() || 'none',
          hasFarcasterParam
        });
        
        // Determine if we're in Farcaster based on multiple signals
        const inFarcaster = sdkAvailable || 
                           (hasParentFrame && (isFarcasterUserAgent || hasFarcasterParam)) ||
                           hasReactNativeWebView;
        
        console.log('🔍 FINAL DECISION:', {
          hasParentFrame,
          hasReactNativeWebView, 
          isFarcasterUserAgent,
          hasFarcasterParam,
          sdkAvailable,
          finalDecision: inFarcaster
        });

        // Show detection results visually for debugging
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const detectionResults = `FARCASTER DETECTION RESULTS:

hasParentFrame: ${hasParentFrame}
hasReactNativeWebView: ${hasReactNativeWebView}
isFarcasterUserAgent: ${isFarcasterUserAgent}
hasFarcasterParam: ${hasFarcasterParam}
sdkAvailable: ${sdkAvailable}

User Agent: ${userAgent.substring(0, 150)}...
Current URL: ${window.location.href}

FINAL DECISION: ${inFarcaster ? 'IN FARCASTER' : 'NOT IN FARCASTER'}`;

            alert(detectionResults);
          }, 1000);
        }
        
        setIsInFarcaster(inFarcaster);
        setFarcasterSDK(sdk);
        
        console.log('🔍 Farcaster detection complete. Result:', inFarcaster ? 'IN FARCASTER' : 'NOT IN FARCASTER');
        
      } catch (error) {
        console.error('🔍 Error detecting Farcaster context:', error);
        setIsInFarcaster(false);
      } finally {
        console.log('🔍 Setting isLoading to false');
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