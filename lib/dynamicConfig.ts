import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";
import { mLog } from "@/utils/mobileLogger";
import { Config } from 'wagmi';

// This creates the Dynamic configuration
export const createDynamicConfig = (config: {
  dynamicEnvironmentId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  wagmiConfig: Config;
}) => {
  mLog.info('DynamicConfig', 'Creating Dynamic configuration');
  
  const networkInfo = getNetworkInfo(config.chainId);
  
  const dynamicSettings = {
    environmentId: config.dynamicEnvironmentId,
    // Use connect-only mode to skip Dynamic's message signing verification
    // We handle authentication via our backend with message signing there,
    // so we don't need Dynamic to do it during wallet connection
    initialAuthenticationMode: 'connect-only' as const,

    // Provide wagmi config so Dynamic's ethers toolkit can access PublicClient
    wagmiConfig: config.wagmiConfig,

    walletConnectors: [
      (props: any) => EthereumWalletConnectors({
        ...props,
        useMetamaskSdk: true, // Enable MetaMask SDK for better compatibility
      })
    ],
    overrides: {
      evmNetworks: [
        {
          blockExplorerUrls: [config.explorerBaseUrl],
          chainId: config.chainId,
          chainName: networkInfo.name,
          iconUrls: [],
          name: networkInfo.name,
          nativeCurrency: {
            decimals: 18,
            name: networkInfo.ticker,
            symbol: networkInfo.ticker
          },
          networkId: config.chainId,
          rpcUrls: [config.rpcUrl],
          vanityName: networkInfo.name
        }
      ]
    }
  };

  // Log the configuration for debugging
  mLog.info('DynamicConfig', 'Dynamic settings created', {
    environmentId: config.dynamicEnvironmentId.substring(0, 10) + '...',
    chainId: config.chainId,
    networkName: networkInfo.name,
    hasWalletConnectors: !!dynamicSettings.walletConnectors,
    connectorCount: dynamicSettings.walletConnectors?.length || 0
  });

  // Log which connectors are actually available
  try {
    if (dynamicSettings.walletConnectors && dynamicSettings.walletConnectors.length > 0) {
      const connectorFunc = dynamicSettings.walletConnectors[0];
      if (typeof connectorFunc === 'function') {
        const connectors = connectorFunc({});
        mLog.info('DynamicConfig', 'Available wallet connectors', {
          connectorNames: connectors?.map((c: any) => c.name || c.constructor?.name || 'unknown') || [],
          connectorCount: connectors?.length || 0
        });
      }
    }
  } catch (error) {
    mLog.warn('DynamicConfig', 'Failed to enumerate connectors', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return dynamicSettings;
};