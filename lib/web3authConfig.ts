import { WALLET_CONNECTORS, WEB3AUTH_NETWORK, Web3AuthOptions } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig, UX_MODE, ADAPTER_EVENTS } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";
import { mLog } from "@/utils/mobileLogger";

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
  mLog.info('Web3AuthConfig', 'Creating Web3Auth configuration');
  mLog.debug('Web3AuthConfig', 'Input config', {
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    web3AuthNetwork: config.web3AuthNetwork,
    hasWalletConnectId: !!config.walletConnectProjectId,
    clientIdPreview: config.web3AuthClientId.substring(0, 20) + '...'
  });

  const networkInfo = getNetworkInfo(config.chainId);
  mLog.debug('Web3AuthConfig', 'Network info retrieved', {
    name: networkInfo.name,
    ticker: networkInfo.ticker,
    tickerName: networkInfo.tickerName
  });

  const chainConfig: CustomChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: toHexString(config.chainId), // Convert to hex
    rpcTarget: config.rpcUrl,
    displayName: networkInfo.name,
    blockExplorerUrl: config.explorerBaseUrl || 'https://basescan.org',
    ticker: networkInfo.ticker,
    tickerName: networkInfo.tickerName,
    logo: networkInfo.logo,
  } as CustomChainConfig;

  mLog.debug('Web3AuthConfig', 'Chain config created', {
    inputChainId: config.chainId,
    hexChainId: chainConfig.chainId,
    displayName: chainConfig.displayName,
    rpcTarget: chainConfig.rpcTarget,
    web3AuthNetwork: config.web3AuthNetwork
  });

  // Create OpenLogin adapter that doesn't auto-redirect
  mLog.debug('Web3AuthConfig', 'Creating OpenLogin adapter', {
    uxMode: UX_MODE.POPUP,
    network: config.web3AuthNetwork
  });

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

  // Configure WalletConnect for mobile wallets if project ID is available
  const modalConfig = config.walletConnectProjectId ? {
    connectors: {
      // Standard auth connector (social logins) - always show
      [WALLET_CONNECTORS.AUTH]: {
        label: "auth",
        showOnModal: true,
        showOnMobile: true,
        showOnDesktop: true,
      },
      // MetaMask connector - only show on desktop (mobile uses WalletConnect)
      [WALLET_CONNECTORS.METAMASK]: {
        label: "metamask",
        showOnModal: true,
        showOnMobile: false, // Mobile MetaMask should use WalletConnect
        showOnDesktop: true,
      },
      // WalletConnect for mobile wallets (including MetaMask Mobile)
      [WALLET_CONNECTORS.WALLET_CONNECT_V2]: {
        label: "Mobile Wallets", // Clear label for mobile users
        showOnModal: true,
        showOnMobile: true,
        showOnDesktop: true, // Also available on desktop for QR code scanning
        adapterSettings: {
          walletConnectInitOptions: {
            projectId: config.walletConnectProjectId,
            metadata: {
              name: "Conduit UCPI",
              description: "Secure escrow payments on Base",
              url: typeof window !== 'undefined' ? window.location.origin : 'https://conduit-ucpi.com',
              icons: ['https://conduit-ucpi.com/logo.png']
            }
          }
        }
      }
    }
  } : undefined;

  // Base Web3Auth options with external wallet configuration
  const web3AuthOptions: Web3AuthOptions = {
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork as any,
    uiConfig: {
      defaultLanguage: "en",
      mode: "auto" as any,
      modalZIndex: "99999",
    },
    modalConfig,
    enableLogging: true,
    sessionTime: 86400,
    // Configure external wallet connections
    privateKeyProvider: undefined, // Let Web3Auth handle this
  };

  mLog.debug('Web3AuthConfig', 'Web3Auth options created', {
    hasClientId: !!web3AuthOptions.clientId,
    network: web3AuthOptions.web3AuthNetwork,
    enableLogging: web3AuthOptions.enableLogging,
    sessionTime: web3AuthOptions.sessionTime,
    modalZIndex: web3AuthOptions.uiConfig?.modalZIndex,
    hasModalConfig: !!modalConfig,
    hasWalletConnectConfig: !!(modalConfig?.connectors?.[WALLET_CONNECTORS.WALLET_CONNECT_V2])
  });

  if (config.walletConnectProjectId) {
    mLog.info('Web3AuthConfig', 'All connectors configured via modalConfig including WalletConnect V2 for mobile wallet connections');
  } else {
    mLog.warn('Web3AuthConfig', 'No WalletConnect project ID provided, using default connectors only');
  }

  mLog.info('Web3AuthConfig', 'Web3Auth configuration completed successfully');

  // Return config with openlogin adapter
  return {
    web3AuthOptions,
    chainConfig,
    openloginAdapter
  };
};