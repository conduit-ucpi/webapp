import { Web3Auth } from "@web3auth/modal";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";

let web3authInstance: Web3Auth | null = null;

export function getWeb3AuthProvider(config: any) {
  return {
    initialize: async () => {
      console.log('🔧 Web3Auth provider: Initialize called');
      // Don't initialize Web3Auth here - wait for user to actually connect
    },
    dispose: async () => {
      if (web3authInstance) {
        console.log('🔧 Web3Auth provider: Disposing instance');
        await web3authInstance.logout();
        web3authInstance = null;
      }
    },
    connect: async () => {
      console.log('🔧 Web3Auth provider: Connect called - initializing Web3Auth modal');

      // Initialize Web3Auth only when user wants to connect
      if (!web3authInstance) {
        console.log('🔧 Web3Auth provider: Creating new Web3Auth instance');
        const web3authConfig = createWeb3AuthConfig(config);
        web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);

        console.log('🔧 Web3Auth provider: Initializing Web3Auth');
        await web3authInstance.init();
        console.log('🔧 Web3Auth provider: Web3Auth initialized');
      }

      // Now connect - this will show the Web3Auth modal for provider selection
      console.log('🔧 Web3Auth provider: Connecting to Web3Auth');
      const provider = await web3authInstance.connect();
      console.log('🔧 Web3Auth provider: Connected, provider:', !!provider);

      return provider;
    },
    disconnect: async () => {
      if (web3authInstance) {
        console.log('🔧 Web3Auth provider: Disconnecting');
        await web3authInstance.logout();
        web3authInstance = null;
      }
    },
    getToken: () => null,
    signMessage: async () => '',
    getEthersProvider: async () => {
      if (web3authInstance?.provider) {
        return web3authInstance.provider;
      }
      return null;
    },
    signContractTransaction: async () => '',
    hasVisitedBefore: () => false,
    markAsVisited: () => {},
    isReady: true,
    getState: () => ({
      user: null,
      token: null,
      isConnected: !!web3authInstance?.connected,
      isLoading: false,
      isInitialized: true,
      error: null,
      providerName: 'web3auth'
    })
  };
}