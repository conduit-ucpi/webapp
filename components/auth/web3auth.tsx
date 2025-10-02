// Stub file to fix import errors during transition to simple approach

export function getWeb3AuthProvider(config?: any) {
  // Temporary stub - returns a minimal provider that will trigger simple ethers flow
  return {
    initialize: async () => {
      console.log('Web3Auth stub initialized');
    },
    dispose: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    getToken: () => null,
    signMessage: async () => '',
    getEthersProvider: async () => null,
    signContractTransaction: async () => '',
    hasVisitedBefore: () => false,
    markAsVisited: () => {},
    isReady: true,
    getState: () => ({
      user: null,
      token: null,
      isConnected: false,
      isLoading: false,
      isInitialized: true,
      error: null,
      providerName: 'web3auth'
    })
  };
}