import { WALLET_CONNECTORS, WEB3AUTH_NETWORK, Web3AuthOptions } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig, UX_MODE, ADAPTER_EVENTS } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
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
  openloginAdapter: OpenloginAdapter;
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

  // Create OpenLogin adapter that doesn't auto-redirect
  const openloginAdapter = new OpenloginAdapter({
    adapterSettings: {
      uxMode: UX_MODE.POPUP, // Use popup mode to prevent auto-redirects
      network: config.web3AuthNetwork as any,
    },
    loginSettings: {
      mfaLevel: "optional",
    },
    privateKeyProvider: undefined, // Will use the default provider
  });

  // Base Web3Auth options (free tier compatible) - prevent auto-redirect but keep options
  const web3AuthOptions: Web3AuthOptions = {
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork as any,
    uiConfig: {
      defaultLanguage: "en",
      mode: "auto" as any,
      modalZIndex: "99999",
    },
    enableLogging: true,
    // Disable problematic connectors on mobile to prevent auto-detection
    ...(typeof window !== 'undefined' && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) && {
      connectorsModalConfig: {
        hideWalletDiscovery: false, // Keep social options visible
        connectors: {
          // Disable MetaMask-specific connectors that auto-detect on mobile
          [WALLET_CONNECTORS.METAMASK]: {
            showOnDesktop: true,
            showOnMobile: false, // Disable MetaMask connector on mobile
          },
          [WALLET_CONNECTORS.WALLET_CONNECT_V2]: {
            showOnDesktop: true,
            showOnMobile: true, // Keep WalletConnect (user can manually choose MetaMask through it)
          },
        }
      }
    }),
  };

  // Return config with adapter
  return {
    web3AuthOptions,
    chainConfig,
    openloginAdapter
  };
};