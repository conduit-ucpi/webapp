import { WALLET_CONNECTORS, WEB3AUTH_NETWORK, Web3AuthOptions } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig, UX_MODE, ADAPTER_EVENTS } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";
import { mLog } from "@/utils/mobileLogger";

// This creates the full Web3Auth config with all adapters
export const createWeb3AuthConfig = async (config: {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  web3AuthNetwork: string;
  walletConnectProjectId?: string;
}): Promise<{
  web3AuthOptions: Web3AuthOptions;
  chainConfig: CustomChainConfig;
  openloginAdapter: OpenloginAdapter;
  walletConnectV2Adapter: any;
}> => {
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
    blockExplorerUrl: config.explorerBaseUrl,
    ticker: networkInfo.ticker,
    tickerName: networkInfo.tickerName,
    logo: networkInfo.logo,
  };

  mLog.debug('Web3AuthConfig', 'Chain config created', {
    inputChainId: config.chainId,
    hexChainId: chainConfig.chainId,
    displayName: chainConfig.displayName,
    rpcTarget: chainConfig.rpcTarget,
    web3AuthNetwork: config.web3AuthNetwork
  });

  // Detect mobile and use appropriate UX mode
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent);
  const uxMode = isMobile ? UX_MODE.REDIRECT : UX_MODE.POPUP;

  mLog.debug('Web3AuthConfig', 'Creating OpenLogin adapter', {
    isMobile,
    uxMode: uxMode === UX_MODE.REDIRECT ? 'REDIRECT' : 'POPUP',
    network: config.web3AuthNetwork
  });

  // Base Web3Auth options with explicit adapter control
  const web3AuthOptions: Web3AuthOptions = {
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork as any,
    uiConfig: {
      defaultLanguage: "en",
      mode: "auto" as any,
      modalZIndex: "99999"
    },
    enableLogging: true,
    sessionTime: 86400,
    // Include WalletConnect project ID to enable WalletConnect
    ...(config.walletConnectProjectId && {
      projectId: config.walletConnectProjectId
    }),
    // Web3Auth v10: Remove custom modalConfig to prevent empty modal on mobile
    // v10 handles adapter visibility automatically based on dashboard configuration
    // Custom modalConfig can cause empty modals on mobile devices
  };

  mLog.debug('Web3AuthConfig', 'Web3Auth options created', {
    hasClientId: !!web3AuthOptions.clientId,
    network: web3AuthOptions.web3AuthNetwork,
    enableLogging: web3AuthOptions.enableLogging,
    sessionTime: web3AuthOptions.sessionTime,
    modalZIndex: web3AuthOptions.uiConfig?.modalZIndex
  });

  mLog.info('Web3AuthConfig', 'Web3Auth configuration completed successfully');

  // Create adapters manually to have full control
  const openloginAdapter = new OpenloginAdapter({
    adapterSettings: {
      uxMode,
      network: config.web3AuthNetwork as any,
    },
    loginSettings: {
      mfaLevel: "optional",
    },
  });

  // Create WalletConnect adapter (dynamically imported to avoid test issues)
  let walletConnectV2Adapter: any = null;
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test' && config.walletConnectProjectId) {
    try {
      // Dynamic import to avoid loading WalletConnect in test environment
      const { WalletConnectModal } = require('@walletconnect/modal');
      const {
        getWalletConnectV2Settings,
        WalletConnectV2Adapter
      } = require('@web3auth/wallet-connect-v2-adapter');

      mLog.debug('Web3AuthConfig', 'Creating WalletConnect configuration', {
        projectId: config.walletConnectProjectId,
        chainId: config.chainId
      });

      // Get WalletConnect settings for the current chain
      const defaultWcSettings = await getWalletConnectV2Settings(
        "eip155",
        [config.chainId],  // Current chain ID
        config.walletConnectProjectId
      );

      // Create WalletConnect modal
      const walletConnectModal = new WalletConnectModal({
        projectId: config.walletConnectProjectId,
      });

      // Create WalletConnect adapter with proper configuration
      walletConnectV2Adapter = new WalletConnectV2Adapter({
        adapterSettings: {
          qrcodeModal: walletConnectModal,
          ...defaultWcSettings.adapterSettings,
        },
        loginSettings: {
          ...defaultWcSettings.loginSettings,
        },
      });

      mLog.info('Web3AuthConfig', 'WalletConnect adapter created successfully');
    } catch (error) {
      mLog.warn('Web3AuthConfig', 'Failed to load WalletConnect adapter', { error });
    }
  }

  // Return config with manually created adapters
  return {
    web3AuthOptions,
    chainConfig,
    openloginAdapter,
    walletConnectV2Adapter
  };
};