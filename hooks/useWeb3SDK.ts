import { useSDK } from '@/components/auth/SDKProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCallback, useEffect, useState } from 'react';
import { WalletProvider as SDKWalletProvider } from '@conduit-ucpi/sdk';
import { ethers } from 'ethers';

/**
 * Custom hook that provides Web3 functionality using the SDK
 * This replaces the old Web3Service usage pattern
 */
export const useWeb3SDK = () => {
  const { sdk, isInitialized, error: sdkError } = useSDK();
  const { walletAddress, getWalletProvider, user, signTransaction, signMessage } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkWalletConnected, setSdkWalletConnected] = useState(false);

  // Create SDK wallet provider adapter
  const createSDKWalletProvider = useCallback((): SDKWalletProvider | null => {
    const walletProvider = getWalletProvider();
    if (!walletProvider || !walletAddress) return null;

    // Create adapter that implements SDK WalletProvider interface
    return {
      getProviderName: () => 'Web3Auth',
      getAddress: async () => {
        if (!walletAddress) throw new Error('No wallet address available');
        return walletAddress;
      },
      getEthersProvider: () => new ethers.BrowserProvider(walletProvider),
      signTransaction: async (txRequest) => {
        console.log('useWeb3SDK adapter signTransaction called with:', txRequest);
        // Use AuthProvider's signTransaction which handles formatting
        const result = await signTransaction(txRequest);
        console.log('useWeb3SDK adapter signTransaction result:', result);
        return result;
      },
      signMessage: async (message: string) => {
        // Use AuthProvider's signMessage
        return await signMessage(message);
      },
      request: async (args: { method: string; params?: any[] }) => {
        return await walletProvider.request(args);
      },
      isConnected: () => !!walletProvider
    };
  }, [walletAddress, getWalletProvider, signTransaction, signMessage]);

  // Initialize SDK with wallet when both are ready
  useEffect(() => {
    const initializeSDKWallet = async () => {
      if (!sdk || !isInitialized || sdkError) {
        setIsReady(false);
        setSdkWalletConnected(false);
        return;
      }

      const walletProvider = getWalletProvider();
      const isConnected = !!walletProvider && !!walletAddress && !!user;

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
  }, [sdk, isInitialized, sdkError, createSDKWalletProvider, walletAddress, user, getWalletProvider, sdkWalletConnected]);

  // Web3 operations using SDK
  const getUSDCBalance = useCallback(async (userAddress?: string): Promise<string> => {
    if (!sdk || !isReady) throw new Error('SDK not ready');
    
    console.log('getUSDCBalance - SDK ready, making call with userAddress:', userAddress);
    
    try {
      if (userAddress) {
        console.log('getUSDCBalance - calling sdk.getUSDCBalanceForAddress...');
        const balance = await sdk.getUSDCBalanceForAddress(userAddress);
        console.log('getUSDCBalance - got balance:', balance);
        return balance;
      } else {
        console.log('getUSDCBalance - calling sdk.getUSDCBalance...');
        const balance = await sdk.getUSDCBalance();
        console.log('getUSDCBalance - got balance:', balance);
        return balance;
      }
    } catch (error) {
      console.error('getUSDCBalance - error:', error);
      throw error;
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

  const walletProvider = getWalletProvider();
  const isConnected = !!walletProvider && !!walletAddress && !!user;

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