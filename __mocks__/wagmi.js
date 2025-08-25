// Mock implementation of wagmi for Jest tests

const mockChain = {
  id: 43114,
  name: 'Avalanche',
  network: 'avalanche',
  nativeCurrency: {
    decimals: 18,
    name: 'Avalanche',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: {
      http: ['https://api.avax.network/ext/bc/C/rpc'],
    },
  },
};

module.exports = {
  WagmiProvider: ({ children }) => children,
  useAccount: () => ({
    isConnected: false,
    address: undefined,
    connector: null,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
    status: 'disconnected',
    addresses: undefined,
    chain: undefined,
    chainId: undefined,
  }),
  useConnect: () => ({
    connect: jest.fn(),
    connectors: [],
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    reset: jest.fn(),
    status: 'idle',
    variables: undefined,
  }),
  useDisconnect: () => ({
    disconnect: jest.fn(),
    disconnectAsync: jest.fn(),
  }),
  createConfig: () => ({}),
  http: () => ({}),
  useWalletClient: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useSignMessage: () => ({
    signMessageAsync: jest.fn(),
    signMessage: jest.fn(),
    data: null,
    isLoading: false,
    error: null,
  }),
  usePublicClient: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useChainId: () => 1,
  useSwitchChain: () => ({
    switchChain: jest.fn(),
    switchChainAsync: jest.fn(),
  }),
  // Mock chains
  avalanche: mockChain,
  avalancheFuji: { ...mockChain, id: 43113, name: 'Avalanche Fuji' },
  // Export all as default for sub-imports
  default: module.exports,
};