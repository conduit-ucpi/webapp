import { useEthersProvider } from '@/components/providers/EthersProvider';
import { useConfig } from '@/components/auth/ConfigProvider';
import { ethers } from 'ethers';

/**
 * Simple hook that provides Web3Service for ALL blockchain operations
 * This is the ONLY way components should access blockchain functionality
 */
export function useSimpleEthers() {
  const { provider, isReady } = useEthersProvider();
  const { config } = useConfig();

  const getWeb3Service = async () => {
    if (!provider) {
      throw new Error('Ethers provider not available');
    }

    if (!config) {
      throw new Error('Config not available');
    }

    const { Web3Service } = await import('@/lib/web3');

    // Get or create Web3Service instance with current config
    const web3Service = Web3Service.getInstance(config);

    // Initialize Web3Service with the current ethers provider if not already initialized
    if (!web3Service.isServiceInitialized()) {
      console.log('🔧 useSimpleEthers: Initializing Web3Service with current ethers provider');
      await web3Service.initializeWithEIP1193(provider.provider);
    }

    return web3Service;
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