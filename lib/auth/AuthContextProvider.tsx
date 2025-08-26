import React, { createContext, useContext, useState, useCallback } from 'react';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthUser, useIdentityToken } from '@web3auth/modal/react';
import { AuthProvider, AuthResult, AuthContextType } from './types';
import { Web3AuthAuthProvider } from './web3auth-provider';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  // Web3Auth hooks
  const { provider, web3Auth } = useWeb3Auth();
  const { connect, isConnected } = useWeb3AuthConnect();
  const { userInfo } = useWeb3AuthUser();
  const { token: idToken } = useIdentityToken();

  console.log('AuthContextProvider - Web3Auth state:', {
    hasWeb3Auth: !!web3Auth,
    isInitialized: web3Auth?.status === 'ready',
    status: web3Auth?.status,
    isConnected,
    hasProvider: !!provider
  });

  // Create Web3Auth provider instance - use useMemo to avoid recreating
  const authProvider = React.useMemo(() => new Web3AuthAuthProvider({
    provider,
    connect,
    isConnected,
    userInfo,
    idToken
  }), [provider, connect, isConnected, userInfo, idToken]);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectAuth = useCallback(async (): Promise<AuthResult> => {
    setIsConnecting(true);
    try {
      const result = await authProvider.connect();
      return result;
    } catch (error) {
      console.error('Auth connection failed:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [authProvider]);

  const disconnectAuth = useCallback(async (): Promise<void> => {
    try {
      await authProvider.disconnect();
    } catch (error) {
      console.error('Auth disconnection failed:', error);
      throw error;
    }
  }, [authProvider]);

  const hasVisitedBefore = authProvider.hasVisitedBefore();

  return (
    <AuthContext.Provider value={{
      authProvider,
      isConnected: authProvider.isConnected(),
      isConnecting,
      userInfo: authProvider.getUserInfo(),
      connectAuth,
      disconnectAuth,
      hasVisitedBefore
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthContextProvider');
  }
  return context;
}