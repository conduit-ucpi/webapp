import { useEthersProvider } from '@/components/providers/EthersProvider';
import { ethers } from 'ethers';

/**
 * Simple hook that provides Web3Service for ALL blockchain operations
 * This is the ONLY way components should access blockchain functionality
 */
export function useSimpleEthers() {
  const { provider, isReady } = useEthersProvider();

  const getWeb3Service = async () => {
    if (!provider) {
      throw new Error('Ethers provider not available');
    }

    const { Web3Service } = await import('@/lib/web3');
    return Web3Service.getInstance();
  };

  return {
    provider, // Still expose for direct access if needed
    isReady,

    // All blockchain operations go through Web3Service
    getWeb3Service,

    // Transaction methods
    fundAndSendTransaction: async (txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }) => {
      console.log('🔧 useSimpleEthers: fundAndSendTransaction via Web3Service');
      const web3Service = await getWeb3Service();
      return await web3Service.fundAndSendTransaction(txParams);
    },

    // Balance methods
    getUSDCBalance: async (address?: string) => {
      console.log('🔧 useSimpleEthers: getUSDCBalance via Web3Service');
      const web3Service = await getWeb3Service();
      const userAddress = address || await web3Service.getUserAddress();
      return await web3Service.getUSDCBalance(userAddress);
    },

    getNativeBalance: async (address?: string) => {
      console.log('🔧 useSimpleEthers: getNativeBalance via ethers provider');
      if (!provider) throw new Error('Provider not available');

      let userAddress: string;
      if (address) {
        userAddress = address;
      } else {
        const signer = await provider.getSigner();
        userAddress = await signer.getAddress();
      }
      const balance = await provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    },

    // Contract query methods
    getContractInfo: async (contractAddress: string) => {
      console.log('🔧 useSimpleEthers: getContractInfo via Web3Service');
      const web3Service = await getWeb3Service();
      return await web3Service.getContractInfo(contractAddress);
    },

    // Utility methods
    getUserAddress: async () => {
      console.log('🔧 useSimpleEthers: getUserAddress via Web3Service');
      const web3Service = await getWeb3Service();
      return await web3Service.getUserAddress();
    }
  };
}