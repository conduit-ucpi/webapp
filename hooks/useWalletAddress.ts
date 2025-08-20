import { useState, useEffect } from 'react';
import { useWeb3SDK } from './useWeb3SDK';

export function useWalletAddress() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getUserAddress, isReady, error } = useWeb3SDK();

  useEffect(() => {
    const getWalletAddress = async () => {
      if (!isReady) {
        setWalletAddress(null);
        setIsLoading(false);
        return;
      }

      if (error) {
        console.error('SDK error:', error);
        setWalletAddress(null);
        setIsLoading(false);
        return;
      }

      try {
        const address = await getUserAddress();
        setWalletAddress(address);
      } catch (error) {
        console.error('Failed to get wallet address:', error);
        setWalletAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    getWalletAddress();
  }, [getUserAddress, isReady, error]);

  return { walletAddress, isLoading };
}