import { useEffect } from 'react';
import { useFarcaster } from './FarcasterDetectionProvider';

/**
 * Component that signals to Farcaster that the mini-app is ready
 * This dismisses the splash screen when running as a Farcaster mini-app
 */
export default function FarcasterReady() {
  const { isInFarcaster, farcasterSDK, isLoading } = useFarcaster();

  useEffect(() => {
    const initializeFarcaster = async () => {
      // Only proceed if we've finished detection and we're in Farcaster
      if (isLoading || !isInFarcaster) {
        return;
      }

      try {
        if (farcasterSDK) {
          // Use the SDK from context if available
          await farcasterSDK.actions.ready();
          console.log('Farcaster mini-app ready signal sent (via context SDK)');
        } else {
          // Fallback: try to import SDK directly
          const { default: sdk } = await import('@farcaster/miniapp-sdk');
          await sdk.actions.ready();
          console.log('Farcaster mini-app ready signal sent (via direct import)');
        }
      } catch (error) {
        console.error('Error sending Farcaster ready signal:', error);
      }
    };

    initializeFarcaster();
  }, [isInFarcaster, farcasterSDK, isLoading]);

  // This component renders nothing - it's just for the side effect
  return null;
}