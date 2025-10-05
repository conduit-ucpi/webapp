import { WALLET_CONNECTORS, WEB3AUTH_NETWORK, Web3AuthOptions } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";

// This creates the full Web3Auth config with all adapters
export const createWeb3AuthConfig = (config: {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  web3AuthNetwork: string;
  walletConnectProjectId?: string;
}): {
  web3AuthOptions: Web3AuthOptions;
  chainConfig: CustomChainConfig;
} => {
  const networkInfo = getNetworkInfo(config.chainId);

  const chainConfig: CustomChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: toHexString(config.chainId), // Convert to hex
    rpcTarget: config.rpcUrl,
    displayName: networkInfo.name,
    blockExplorerUrl: config.explorerBaseUrl,
    ticker: networkInfo.ticker,
    tickerName: networkInfo.tickerName,
    logo: networkInfo.logo,
  };

  console.log('🔧 Web3Auth chainConfig created:', {
    inputChainId: config.chainId,
    hexChainId: chainConfig.chainId,
    displayName: chainConfig.displayName,
    rpcTarget: chainConfig.rpcTarget,
    web3AuthNetwork: config.web3AuthNetwork
  });

  // Base Web3Auth options with social logins enabled
  const web3AuthOptions: Web3AuthOptions = {
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork as any,
    uiConfig: {
      appName: "Conduit UCPI",
      logoLight: "https://web3auth.io/images/web3authlog.png",
      logoDark: "https://web3auth.io/images/web3authlogodark.png",
      defaultLanguage: "en",
      mode: "auto" as any,
      theme: {
        primary: "#0364ff",
      },
    },
  };

  // Return config that can be used to configure adapters separately
  return {
    web3AuthOptions,
    chainConfig, // Also return chainConfig for use in adapters
  };
};