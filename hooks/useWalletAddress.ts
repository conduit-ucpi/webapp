import { useState, useEffect } from 'react';

export function useWalletAddress() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getWalletAddress = async () => {
      try {
        const web3authProvider = (window as any).web3authProvider;
        if (web3authProvider) {
          const accounts = await web3authProvider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          } else {
            setWalletAddress(null);
          }
        } else {
          setWalletAddress(null);
        }
      } catch (error) {
        console.error('Failed to get wallet address:', error);
        setWalletAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    getWalletAddress();
  }, []);

  return { walletAddress, isLoading };
}