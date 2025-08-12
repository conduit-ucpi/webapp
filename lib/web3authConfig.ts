import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";

// This matches the pattern from the Web3Auth examples
export const createWeb3AuthConfig = (config: {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  snowtraceBaseUrl: string;
  web3AuthNetwork: string;
}): Web3AuthContextConfig => {
  return {
    web3AuthOptions: {
      clientId: config.web3AuthClientId,
      web3AuthNetwork: config.web3AuthNetwork as any, // Will be WEB3AUTH_NETWORK.SAPPHIRE_MAINNET or similar
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
  };
};