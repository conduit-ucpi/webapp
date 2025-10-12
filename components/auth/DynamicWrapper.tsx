/**
 * Dynamic.xyz React wrapper component
 * Provides the Dynamic context and bridges to our unified provider system
 */

import React, { useEffect } from 'react';
import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { createDynamicConfig } from '@/lib/dynamicConfig';
import { AuthConfig } from '@/lib/auth/types';
import { mLog } from '@/utils/mobileLogger';

interface DynamicWrapperProps {
  children: React.ReactNode;
  config: AuthConfig;
}

// Bridge component that connects Dynamic to our global window methods
function DynamicBridge() {
  const { setShowAuthFlow, primaryWallet, user, handleLogOut } = useDynamicContext();

  useEffect(() => {
    // Expose Dynamic methods to our unified provider system
    if (typeof window !== 'undefined') {
      (window as any).dynamicLogin = async () => {
        mLog.info('DynamicBridge', 'Opening Dynamic auth flow');
        setShowAuthFlow(true);
        
        // Return a promise that resolves when wallet is connected
        return new Promise((resolve) => {
          const checkConnection = () => {
            if (primaryWallet && user) {
              mLog.info('DynamicBridge', 'Dynamic connection successful', {
                address: primaryWallet.address,
                walletName: primaryWallet.connector?.name
              });
              resolve({
                address: primaryWallet.address,
                provider: primaryWallet.connector,
                user: user
              });
            } else {
              // Keep checking until connected
              setTimeout(checkConnection, 100);
            }
          };
          
          checkConnection();
        });
      };

      (window as any).dynamicLogout = async () => {
        mLog.info('DynamicBridge', 'Dynamic logout called');
        await handleLogOut();
      };

      (window as any).dynamicUser = user;
    }
  }, [setShowAuthFlow, primaryWallet, user, handleLogOut]);

  return null; // This component doesn't render anything
}

export function DynamicWrapper({ children, config }: DynamicWrapperProps) {
  if (!config.dynamicEnvironmentId) {
    // No Dynamic config, return children without wrapper
    return <>{children}</>;
  }

  const dynamicSettings = createDynamicConfig({
    dynamicEnvironmentId: config.dynamicEnvironmentId,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerBaseUrl: config.explorerBaseUrl || ''
  });

  // Dynamic wrapper initialized (reduced logging)

  return (
    <DynamicContextProvider
      settings={dynamicSettings as any}
      theme="auto"
      children={
        <>
          <DynamicBridge />
          {children}
        </>
      }
    />
  );
}