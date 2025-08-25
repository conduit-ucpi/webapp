import { useEffect, useState } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

/**
 * Hook to get the current Web3 provider, regardless of auth method
 * Works with both Web3Auth and Farcaster/Wagmi providers
 */
export function useProvider() {
  const { isInFarcaster } = useFarcaster();
  const [provider, setProvider] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // For Farcaster/Wagmi
  const { connector } = useAccount();

  useEffect(() => {
    const getProvider = async () => {
      setIsLoading(true);
      try {
        if (isInFarcaster && connector) {
          // Get provider from Wagmi connector
          const wagmiProvider = await connector.getProvider();
          setProvider(wagmiProvider);
        } else {
          // Get Web3Auth provider from window (if available)
          const web3AuthProvider = (window as any).web3authProvider;
          setProvider(web3AuthProvider);
        }
      } catch (error) {
        console.error('Failed to get provider:', error);
        setProvider(null);
      } finally {
        setIsLoading(false);
      }
    };

    getProvider();
  }, [isInFarcaster, connector]);

  return { provider, isLoading };
}

/**
 * Hook to get an ethers provider instance
 */
export function useEthersProvider() {
  const { provider } = useProvider();
  const [ethersProvider, setEthersProvider] = useState<ethers.BrowserProvider | null>(null);

  useEffect(() => {
    if (provider) {
      try {
        const web3Provider = new ethers.BrowserProvider(provider);
        setEthersProvider(web3Provider);
      } catch (error) {
        console.error('Failed to create ethers provider:', error);
        setEthersProvider(null);
      }
    } else {
      setEthersProvider(null);
    }
  }, [provider]);

  return ethersProvider;
}