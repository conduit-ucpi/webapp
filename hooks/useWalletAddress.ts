import { useState, useEffect } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';
import { Web3Service } from '@/lib/web3';

export function useWalletAddress() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { config } = useConfig();
  const { web3authProvider } = useWeb3AuthInstance();

  useEffect(() => {
    const getWalletAddress = async () => {
      if (!config || !web3authProvider) {
        setWalletAddress(null);
        setIsLoading(false);
        return;
      }

      try {
        const web3Service = new Web3Service(config);
        await web3Service.initializeProvider(web3authProvider);
        const address = await web3Service.getUserAddress();
        setWalletAddress(address);
      } catch (error) {
        console.error('Failed to get wallet address:', error);
        setWalletAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    getWalletAddress();
  }, [config, web3authProvider]);

  return { walletAddress, isLoading };
}