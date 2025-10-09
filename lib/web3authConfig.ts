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

  const openloginAdapter = new OpenloginAdapter({
    adapterSettings: {
      uxMode, // Use redirect for mobile, popup for desktop
      network: config.web3AuthNetwork as any,
    },
    loginSettings: {
      mfaLevel: "optional",
    },
    privateKeyProvider: undefined, // Will use the default provider
  });


  // Base Web3Auth options with WalletConnect project ID
  const web3AuthOptions: Web3AuthOptions = {
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork as any,
    uiConfig: {
      defaultLanguage: "en",
      mode: "auto" as any,
      modalZIndex: "99999",
    },
    enableLogging: true,
    sessionTime: 86400,
    // Include WalletConnect project ID to enable WalletConnect
    ...(config.walletConnectProjectId && {
      projectId: config.walletConnectProjectId
    })
  };

  mLog.debug('Web3AuthConfig', 'Web3Auth options created', {
    hasClientId: !!web3AuthOptions.clientId,
    network: web3AuthOptions.web3AuthNetwork,
    enableLogging: web3AuthOptions.enableLogging,
    sessionTime: web3AuthOptions.sessionTime,
    modalZIndex: web3AuthOptions.uiConfig?.modalZIndex
  });

  mLog.info('Web3AuthConfig', 'Web3Auth configuration completed successfully');

  // Return simplified config
  return {
    web3AuthOptions,
    chainConfig
  };
};