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

  // Single effect: run synchronous detection after mount (avoids hydration mismatch)
  useEffect(() => {
    try {
      // Method 1: Check for Farcaster-specific window properties
      const hasParentFrame = window.parent !== window;
      const hasReactNativeWebView = 'ReactNativeWebView' in window;

      // Method 2: Check user agent for Farcaster clients
      const userAgent = navigator.userAgent;
      const isFarcasterUserAgent = userAgent.includes('Farcaster') || userAgent.includes('Warpcast');

      // Method 3: Try to detect Farcaster SDK
      let sdkAvailable = false;
      let sdk = null;

      try {
        const fcSDK = (window as any).__farcaster__;
        if (fcSDK) {
          sdkAvailable = true;
          sdk = fcSDK;
        }
      } catch (e) {
        // Silently handle SDK check errors
      }

      // Method 4: Check for specific URL patterns
      const urlParams = new URLSearchParams(window.location.search);
      const hasFarcasterParam = urlParams.has('fc_frame') || urlParams.has('farcaster');

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