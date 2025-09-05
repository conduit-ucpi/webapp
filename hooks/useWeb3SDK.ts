import { useSDK } from '@/components/auth/SDKProvider';
import { useAuth } from '@/components/auth';
import { useCallback, useEffect, useState } from 'react';
import { WalletProvider as SDKWalletProvider } from '@conduit-ucpi/sdk';

/**
 * Custom hook that provides Web3 functionality using the SDK
 * This replaces the old Web3Service usage pattern
 */
export const useWeb3SDK = () => {
  const { sdk, isInitialized, error: sdkError } = useSDK();
  const authContext = useAuth();
  const { user, isConnected, signMessage, getEthersProvider } = authContext;
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkWalletConnected, setSdkWalletConnected] = useState(false);

  // Create SDK wallet provider adapter
  const createSDKWalletProvider = useCallback((): SDKWalletProvider | null => {
    if (!user?.walletAddress || !isConnected) return null;

    // Create adapter that implements SDK WalletProvider interface
    return {
      getProviderName: () => user.authProvider || 'Unknown',
      getAddress: async () => {
        if (!user.walletAddress) throw new Error('No wallet address available');
        return user.walletAddress;
      },
      getEthersProvider: () => {
        // Use the real ethers provider from the auth system
        return getEthersProvider();
      },
      signTransaction: async (txRequest) => {
        // Use the ethers provider to sign the transaction
        const ethersProvider = getEthersProvider();
        const signer = await ethersProvider.getSigner();
        return await signer.signTransaction(txRequest);
      },
      signMessage: async (message: string) => {
        return await signMessage(message);
      },
      request: async (args: { method: string; params?: any[] }) => {
        // TODO: Need to implement provider requests in new auth system
        console.warn('Provider request called but not implemented in new auth system:', args);
        throw new Error('Provider request not yet implemented in new auth system');
      },
      isConnected: () => isConnected
    };
  }, [user, isConnected, signMessage]);

  // Reset SDK connection when wallet address changes
  useEffect(() => {
    if (sdkWalletConnected && user?.walletAddress) {
      // Force reconnection when wallet address changes
      setSdkWalletConnected(false);
    }
  }, [user?.walletAddress]);

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
  }, [sdk, isInitialized, sdkError, createSDKWalletProvider, isConnected, sdkWalletConnected, user?.walletAddress]);

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