import { useEffect } from 'react';

/**
 * Component that signals to Farcaster that the mini-app is ready
 * This dismisses the splash screen when running as a Farcaster mini-app
 */
export default function FarcasterReady() {
  useEffect(() => {
    const initializeFarcaster = async () => {
      // Check if we're running in a Farcaster context
      try {
        // Dynamically import Farcaster SDK to avoid errors in regular web context
        const { default: sdk } = await import('@farcaster/miniapp-sdk');
        
        // Signal that the mini-app is ready (dismisses splash screen)
        await sdk.actions.ready();
        
        console.log('Farcaster mini-app ready signal sent');
      } catch (error) {
        // Silently fail if not in Farcaster context or SDK not available
        // This is expected behavior for regular web users
        console.log('Not running in Farcaster context or SDK unavailable');
      }
    };

    initializeFarcaster();
  }, []);

  // This component renders nothing - it's just for the side effect
  return null;
}