import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";
import { mLog } from "@/utils/mobileLogger";

// This creates the Dynamic configuration
export const createDynamicConfig = (config: {
  dynamicEnvironmentId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
}) => {
  mLog.info('DynamicConfig', 'Creating Dynamic configuration');
  
  const networkInfo = getNetworkInfo(config.chainId);
  
  const dynamicSettings = {
    environmentId: config.dynamicEnvironmentId,
    walletConnectors: [EthereumWalletConnectors],
    // Reduce SDK logging
    logLevel: 'error', // Only show errors, not debug info
    debugMode: false,
    eventsCallbacks: {
      onAuthSuccess: (user: any) => {
        mLog.info('DynamicConfig', 'Auth success', {
          address: user.verifiedCredentials?.[0]?.address
        });
      },
      onLogout: () => {
        mLog.info('DynamicConfig', 'User logged out');
      }
    },
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

  // Reduced logging to minimize console output

  return dynamicSettings;
};