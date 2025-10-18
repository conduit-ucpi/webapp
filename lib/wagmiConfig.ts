/**
 * Wagmi configuration for Dynamic.xyz integration
 * Provides the PublicClient that Dynamic's ethers toolkit requires
 */

import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { mLog } from '@/utils/mobileLogger'

export const createWagmiConfig = (config: {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId?: string;
}) => {
  mLog.info('WagmiConfig', 'Creating wagmi configuration', {
    chainId: config.chainId,
    hasWalletConnectId: !!config.walletConnectProjectId
  });

  // Determine which chain we're using
  const chain = config.chainId === 8453 ? base : baseSepolia;

  // Create connectors with proper typing by passing them as a factory function
  const connectorsList = [];

  connectorsList.push(injected());

  // Add WalletConnect if project ID is available
  if (config.walletConnectProjectId) {
    connectorsList.push(
      walletConnect({
        projectId: config.walletConnectProjectId,
        showQrModal: false // Dynamic handles the UI
      }) as any // Type assertion to work around wagmi version incompatibilities
    );
  }

  // Add Coinbase Wallet
  connectorsList.push(
    coinbaseWallet({
      appName: 'Conduit UCPI',
      headlessMode: true // Dynamic handles the UI
    }) as any // Type assertion to work around wagmi version incompatibilities
  );

  const wagmiConfig = createConfig({
    chains: [chain] as const,
    transports: {
      [base.id]: http(config.chainId === 8453 ? config.rpcUrl : 'https://mainnet.base.org'),
      [baseSepolia.id]: http(config.chainId === 84532 ? config.rpcUrl : 'https://sepolia.base.org')
    },
    connectors: connectorsList as any
  });

  mLog.info('WagmiConfig', 'Wagmi config created successfully', {
    chainId: chain.id,
    chainName: chain.name,
    connectorCount: connectorsList.length
  });

  return wagmiConfig;
};
