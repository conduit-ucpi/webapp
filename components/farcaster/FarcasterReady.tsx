import { useEffect } from 'react';

/**
 * Component that signals to Farcaster that the mini-app is ready
 * This dismisses the splash screen when running as a Farcaster mini-app
 * 
 * This runs immediately without waiting for detection logic to avoid splash screen issues
 */
export default function FarcasterReady() {
  useEffect(() => {
    const initializeFarcaster = async () => {
      // Skip in test environment or SSR
      if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
        return;
      }

      try {
        // Always try to send ready signal - if we're not in Farcaster, this will just be ignored
        const { default: sdk } = await import('@farcaster/miniapp-sdk');
        await sdk.actions.ready();
        console.log('Farcaster mini-app ready signal sent');
      } catch (error) {
        // Silently ignore - we're probably not in Farcaster context
        console.log('Farcaster ready signal not sent (likely not in Farcaster):', error instanceof Error ? error.message : String(error));
      }
    };

    // Send ready signal immediately on mount
    initializeFarcaster();
  }, []);

  // This component renders nothing - it's just for the side effect
  return null;
}