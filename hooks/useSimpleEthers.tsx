import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { ethers } from 'ethers';
import { useCallback } from 'react';
import { mLog } from '@/utils/mobileLogger';

/**
 * Simple hook that provides Web3Service for ALL blockchain operations
 * This is the ONLY way components should access blockchain functionality
 */
export function useSimpleEthers() {
  const { isConnected, getEthersProvider, authenticatedFetch } = useAuth();
  const { config } = useConfig();

  const getWeb3Service = useCallback(async () => {
    if (!config) {
      throw new Error('Config not available');
    }

    const { Web3Service } = await import('@/lib/web3');

    // Get or create Web3Service instance with current config
    const web3Service = Web3Service.getInstance(config);

    // CRITICAL: Only get ethers provider if Web3Service is NOT initialized
    // This prevents repeated WalletConnect provider requests on mobile (causes popups)
    if (!web3Service.isServiceInitialized()) {
      console.log('🔧 useSimpleEthers: Initializing Web3Service with ethers provider');

      // Get the ethers provider from auth (only when needed)
      const ethersProvider = await getEthersProvider();
      if (!ethersProvider) {
        throw new Error('Wallet not connected');
      }

      await web3Service.initialize(ethersProvider);
    } else {
      console.log('🔧 useSimpleEthers: Web3Service already initialized, reusing existing instance');
    }

    return web3Service;
  }, [config, getEthersProvider]);

  return {
    provider: null, // Legacy compatibility
    isReady: isConnected,

    // All blockchain operations go through Web3Service
    getWeb3Service,

    // Transaction methods
    fundAndSendTransaction: async (txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }) => {
      console.log('🔧 useSimpleEthers: fundAndSendTransaction via Web3Service');
      const web3Service = await getWeb3Service();
      return await web3Service.fundAndSendTransaction(txParams);
    },

    // Balance methods - READ-ONLY operations (NO WALLET ACCESS!)
    getUSDCBalance: useCallback(async (userAddress: string) => {
      console.log('🔧 useSimpleEthers: getUSDCBalance via READ-ONLY RPC (no wallet access)');

      if (!config) {
        throw new Error('Config not available');
      }

      const { Web3Service } = await import('@/lib/web3');
      const web3Service = Web3Service.getInstance(config);

      // Balance reading uses READ-ONLY RPC provider
      // This NEVER touches the wallet, even on mobile!
      return await web3Service.getUSDCBalance(userAddress);
    }, [config]),

    getNativeBalance: useCallback(async (userAddress: string) => {
      console.log('🔧 useSimpleEthers: getNativeBalance via READ-ONLY RPC (no wallet access)');

      if (!config) {
        throw new Error('Config not available');
      }

      const { Web3Service } = await import('@/lib/web3');
      const web3Service = Web3Service.getInstance(config);

      // Balance reading uses READ-ONLY RPC provider
      // This NEVER touches the wallet, even on mobile!
      return await web3Service.getNativeBalance(userAddress);
    }, [config]),

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
    },

    // High-level contract interaction methods
    approveUSDC: async (contractAddress: string, amount: string, tokenAddress?: string) => {
      // Use provided tokenAddress or fall back to USDC contract address for backward compatibility
      const targetTokenAddress = tokenAddress || config?.usdcContractAddress;

      if (!targetTokenAddress) {
        throw new Error('Token contract address not provided');
      }

      const maxGasPriceEth = (parseFloat(config?.maxGasPriceGwei || '0') / 1000000000);
      const maxGasCostEth = (parseFloat(config?.maxGasCostGwei || '0') / 1000000000);

      console.log('');
      console.log('='.repeat(80));
      console.log('💰 TOKEN APPROVAL TRANSACTION');
      console.log('='.repeat(80));
      console.log('📋 Approval Details:');
      console.log(`   Token Contract: ${targetTokenAddress}`);
      console.log(`   Spender (Escrow): ${contractAddress}`);
      console.log(`   Amount (micro units): ${amount}`);
      console.log(`   Amount (tokens): ${(Number(amount) / 1000000).toFixed(6)}`);
      console.log('');
      console.log('⚙️  Gas Configuration:');
      console.log(`   MAX_GAS_PRICE_GWEI: ${config?.maxGasPriceGwei} gwei (${maxGasPriceEth.toExponential(4)} ETH)`);
      console.log(`   MAX_GAS_COST_GWEI: ${config?.maxGasCostGwei} gwei (${maxGasCostEth.toExponential(4)} ETH)`);
      console.log(`   USDC_GRANT_FOUNDRY_GAS: ${config?.usdcGrantFoundryGas} gas`);
      console.log(`   GAS_PRICE_BUFFER: ${config?.gasPriceBuffer}x`);
      console.log('');

      // Encode token approve function call (standard ERC20 interface)
      const tokenAbi = [
        "function approve(address spender, uint256 amount) external returns (bool)"
      ];
      const tokenInterface = new ethers.Interface(tokenAbi);
      const data = tokenInterface.encodeFunctionData('approve', [
        contractAddress, // spender (the escrow contract)
        amount // amount in micro units as string
      ]);

      console.log('🔧 Calling fundAndSendTransaction...');
      const web3Service = await getWeb3Service();
      return await web3Service.fundAndSendTransaction({
        to: targetTokenAddress, // Use the correct token address (USDC or USDT)
        data,
        value: '0' // No ETH value needed for approval
      });
    },

    depositToContract: async (contractAddress: string) => {
      console.log('🔧 useSimpleEthers: depositToContract via fundAndSendTransaction');

      // Encode escrow contract deposit function call using hardcoded ABI
      const escrowAbi = [
        "function depositFunds() external"
      ];
      const escrowInterface = new ethers.Interface(escrowAbi);
      const data = escrowInterface.encodeFunctionData('depositFunds', []);

      const web3Service = await getWeb3Service();
      return await web3Service.fundAndSendTransaction({
        to: contractAddress,
        data,
        value: '0' // No ETH value needed for deposit
      });
    },

    depositFundsAsProxy: async (contractAddress: string) => {
      console.log('🔧 useSimpleEthers: depositFundsAsProxy via chainservice');

      if (!authenticatedFetch) {
        throw new Error('authenticatedFetch is not available');
      }

      // Call chainservice to deposit funds as gas payer
      const response = await authenticatedFetch('/api/chain/fund-approved-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractHash: contractAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to deposit funds via proxy');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Deposit failed');
      }

      // Return transaction hash in same format as depositToContract
      return result.transactionHash;
    }
  };
}