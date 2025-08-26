import { useSDK } from '@/components/auth/SDKProvider';
import { useWallet } from '@/components/auth/UnifiedAuthProvider';
import { useCallback, useEffect, useState } from 'react';
import { WalletProvider as SDKWalletProvider } from '@conduit-ucpi/sdk';

/**
 * Custom hook that provides Web3 functionality using the SDK
 * This replaces the old Web3Service usage pattern
 */
export const useWeb3SDK = () => {
  const { sdk, isInitialized, error: sdkError } = useSDK();
  const { walletProvider, isConnected, address } = useWallet();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkWalletConnected, setSdkWalletConnected] = useState(false);

  // Create SDK wallet provider adapter
  const createSDKWalletProvider = useCallback((): SDKWalletProvider | null => {
    if (!walletProvider || !isConnected) return null;

    // Create adapter that implements SDK WalletProvider interface
    return {
      getProviderName: () => 'Web3Auth',
      getAddress: async () => {
        if (!address) throw new Error('No wallet address available');
        return address;
      },
      getEthersProvider: () => walletProvider.getEthersProvider(),
      signTransaction: async (txRequest) => {
        return await walletProvider.signTransaction(txRequest);
      },
      signMessage: async (message: string) => {
        return await walletProvider.signMessage(message);
      },
      request: async (args: { method: string; params?: any[] }) => {
        return await walletProvider.request(args);
      },
      isConnected: () => walletProvider.isConnected()
    };
  }, [walletProvider, isConnected, address]);

  // Initialize SDK with wallet when both are ready
  useEffect(() => {
    const initializeSDKWallet = async () => {
      if (!sdk || !isInitialized || sdkError) {
        setIsReady(false);
        setSdkWalletConnected(false);
        return;
      }

      // If SDK is ready but wallet isn't connected to SDK yet, connect it
      if (isConnected && !sdkWalletConnected) {
        try {
          const sdkWalletProvider = createSDKWalletProvider();
          if (sdkWalletProvider) {
            console.log('Connecting wallet to SDK...');
            await sdk.connectWallet(sdkWalletProvider);
            setSdkWalletConnected(true);
            setIsReady(true);
            setError(null);
            console.log('Wallet connected to SDK successfully');
          } else {
            setIsReady(false);
          }
        } catch (err) {
          console.error('Failed to connect wallet to SDK:', err);
          setError(err instanceof Error ? err.message : 'Failed to connect wallet');
          setIsReady(false);
          setSdkWalletConnected(false);
        }
      } else if (isConnected && sdkWalletConnected) {
        // Both wallet and SDK are connected - we're ready
        setIsReady(true);
        setError(null);
      } else {
        // Wallet not connected
        setIsReady(false);
        setSdkWalletConnected(false);
      }
    };

    initializeSDKWallet();
  }, [sdk, isInitialized, sdkError, createSDKWalletProvider, isConnected, sdkWalletConnected]);

  // Web3 operations using SDK
  const getUSDCBalance = useCallback(async (userAddress?: string): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    
    if (userAddress) {
      return await sdk.getUSDCBalanceForAddress(userAddress);
    } else {
      return await sdk.getUSDCBalance();
    }
  }, [sdk, isReady]);

  const getUSDCAllowance = useCallback(async (spenderAddress: string): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.getUSDCAllowance(spenderAddress);
  }, [sdk, isReady]);

  const signUSDCTransfer = useCallback(async (to: string, amount: string): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.signUSDCTransfer(to, amount);
  }, [sdk, isReady]);

  const getContractInfo = useCallback(async (contractAddress: string) => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.getContractInfo(contractAddress);
  }, [sdk, isReady]);

  const getContractState = useCallback(async (contractAddress: string) => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.getContractState(contractAddress);
  }, [sdk, isReady]);

  const signContractTransaction = useCallback(async (params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
  }): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.signContractTransaction(params);
  }, [sdk, isReady]);

  const hashDescription = useCallback((description: string): string => {
    if (!sdk) throw new Error('SDK not ready');
    return sdk.hashDescription(description);
  }, [sdk]);

  const getUserAddress = useCallback(async (): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    return await sdk.getWalletAddress();
  }, [sdk, isReady]);

  // Service clients
  const services = sdk?.services;

  // Utils from SDK
  const utils = sdk?.utils;

  return {
    // State
    isReady,
    error: error || sdkError,
    isConnected: isReady && isConnected,
    
    // Web3 operations
    getUSDCBalance,
    getUSDCAllowance,
    signUSDCTransfer,
    getContractInfo,
    getContractState,
    signContractTransaction,
    hashDescription,
    getUserAddress,
    
    // Service clients
    services,
    
    // Utilities
    utils,
    
    // SDK instance (for advanced usage)
    sdk
  };
};

export default useWeb3SDK;