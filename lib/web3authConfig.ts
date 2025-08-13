import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";

// This matches the pattern from the Web3Auth examples
export const createWeb3AuthConfig = (config: {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  snowtraceBaseUrl: string;
  web3AuthNetwork: string;
}): Web3AuthContextConfig => {
  // Determine network name based on chainId
  const getNetworkDisplayName = () => {
    switch (config.chainId) {
      case 43114:
        return 'Avalanche C-Chain';
      case 43113:
        return 'Avalanche Fuji Testnet';
      default:
        return `Avalanche Chain ${config.chainId}`;
    }
  };

  const chainConfig: CustomChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: `0x${config.chainId.toString(16)}`, // Convert to hex
    rpcTarget: config.rpcUrl,
    displayName: getNetworkDisplayName(),
    blockExplorerUrl: config.snowtraceBaseUrl,
    ticker: 'AVAX',
    tickerName: 'Avalanche',
    logo: 'https://images.toruswallet.io/avax.svg',
  };

  console.log('🔧 Web3Auth chainConfig created:', {
    inputChainId: config.chainId,
    hexChainId: chainConfig.chainId,
    displayName: chainConfig.displayName,
    rpcTarget: chainConfig.rpcTarget,
    web3AuthNetwork: config.web3AuthNetwork
  });

  return {
    web3AuthOptions: {
      clientId: config.web3AuthClientId,
      web3AuthNetwork: config.web3AuthNetwork as any, // Will be WEB3AUTH_NETWORK.SAPPHIRE_MAINNET or similar
      chainConfig,
      uiConfig: {
        appName: "Conduit UCPI",
        theme: {
          primary: "#0364ff",
        },
        mode: "auto",
        logoLight: "https://web3auth.io/images/web3authlog.png",
        logoDark: "https://web3auth.io/images/web3authlogodark.png",
        defaultLanguage: "en",
        loginGridCol: 3,
        primaryButton: "externalLogin",
      },
      modalConfig: {
        connectors: {
          [WALLET_CONNECTORS.AUTH]: {
            label: "auth",
            loginMethods: {
              google: {
                name: "google login",
                showOnModal: true,
              },
              facebook: {
                name: "facebook login", 
                showOnModal: true,
              },
              email_passwordless: {
                name: "email passwordless login",
                showOnModal: true,
              },
            },
            showOnModal: true,
          },
        },
      },
    },
  } as Web3AuthContextConfig;
};