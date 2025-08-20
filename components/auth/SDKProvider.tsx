import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { EscrowSDK, Config } from '@conduit-ucpi/sdk';
import { useConfig } from './ConfigProvider';

interface SDKContextType {
  sdk: EscrowSDK | null;
  isInitialized: boolean;
  error: string | null;
}

const SDKContext = createContext<SDKContextType>({
  sdk: null,
  isInitialized: false,
  error: null,
});

export const useSDK = () => {
  const context = useContext(SDKContext);
  if (!context) {
    throw new Error('useSDK must be used within a SDKProvider');
  }
  return context;
};

interface SDKProviderProps {
  children: ReactNode;
}

export const SDKProvider: React.FC<SDKProviderProps> = ({ children }) => {
  const [sdk, setSDK] = useState<EscrowSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config } = useConfig();

  useEffect(() => {
    if (!config) return;

    try {
      // Create SDK configuration from webapp config
      const sdkConfig = new Config({
        chainId: config.chainId,
        rpcUrl: config.rpcUrl,
        usdcContractAddress: config.usdcContractAddress,
        contractFactoryAddress: config.contractAddress,
        userServiceUrl: '/api/user', // Use API routes
        chainServiceUrl: '/api/chain', // Use API routes
        contractServiceUrl: '/api/contracts', // Use API routes
        minGasWei: config.minGasWei,
        snowtraceBaseUrl: config.snowtraceBaseUrl,
        serviceLink: config.serviceLink
      });

      // Initialize SDK
      const escrowSDK = new EscrowSDK(sdkConfig);
      setSDK(escrowSDK);
      setIsInitialized(true);
      setError(null);

      console.log('SDK initialized successfully:', escrowSDK.getSDKInfo());
    } catch (err) {
      console.error('Failed to initialize SDK:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsInitialized(false);
    }

    return () => {
      if (sdk) {
        sdk.destroy();
      }
    };
  }, [config]);

  const value: SDKContextType = {
    sdk,
    isInitialized,
    error,
  };

  return (
    <SDKContext.Provider value={value}>
      {children}
    </SDKContext.Provider>
  );
};

export default SDKProvider;