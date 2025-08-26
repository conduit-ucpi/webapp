import React from 'react';
import { useAuthContext } from '@/lib/auth/AuthContextProvider';
import { GenericAuthProvider } from './GenericAuthProvider';

/**
 * Wrapper that provides Web3Auth-specific connect method to GenericAuthProvider
 */
export function Web3AuthConnectProvider({ children }: { children: React.ReactNode }) {
  const authContextData = useAuthContext();

  const web3AuthConnect = React.useCallback(async () => {
    if (!authContextData) {
      throw new Error('No Web3Auth context available');
    }

    try {
      console.log('Web3Auth connect method called via unified interface');
      
      // Use Web3Auth connection flow - this opens the modal
      const authResult = await authContextData.connectAuth();
      
      console.log('Web3Auth modal connection successful, auth result:', authResult);
      
      // The login will happen automatically through the auth result
      // No need to call login manually here since authResult should trigger the auth flow
      
    } catch (error: any) {
      console.error('Web3Auth connection failed:', error);
      
      if (error.message?.includes('User closed the modal')) {
        // User cancelled - don't show error, just rethrow
        throw new Error('Connection cancelled by user');
      } else {
        throw new Error(`Failed to connect: ${error.message || 'Unknown error'}`);
      }
    }
  }, [authContextData]);

  return (
    <GenericAuthProvider connectMethod={web3AuthConnect}>
      {children}
    </GenericAuthProvider>
  );
}