import '@testing-library/jest-dom'

// Polyfill for crypto and TextEncoder/TextDecoder for Web3Auth
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock crypto for Node.js environment
const crypto = require('crypto')
Object.defineProperty(global, 'crypto', {
  value: {
    ...crypto,
    subtle: crypto.webcrypto?.subtle,
    getRandomValues: (arr) => crypto.randomFillSync(arr)
  }
})

// Mock Web3Auth modules to prevent crypto issues during testing
jest.mock('@web3auth/modal', () => ({
  Web3Auth: jest.fn().mockImplementation(() => ({
    connected: false,
    provider: null,
    initModal: jest.fn(),
    connect: jest.fn(),
    logout: jest.fn(),
    addPlugin: jest.fn()
  })),
  WALLET_CONNECTORS: {
    AUTH: 'auth'
  },
  WEB3AUTH_NETWORK: {
    SAPPHIRE_MAINNET: 'sapphire_mainnet'
  }
}))

// Mock Web3Auth React hooks
jest.mock('@web3auth/modal/react', () => ({
  Web3AuthProvider: ({ children }) => children,
  useWeb3Auth: () => ({
    provider: null,
    web3Auth: null,
    status: 'ready'
  }),
  useWeb3AuthConnect: () => ({
    connect: jest.fn(),
    isConnected: false,
    connectorName: null
  }),
  useWeb3AuthUser: () => ({
    userInfo: null
  }),
  useWeb3AuthDisconnect: () => ({
    disconnect: jest.fn()
  }),
  useIdentityToken: () => ({
    token: null
  })
}))

jest.mock('@web3auth/base', () => ({
  CHAIN_NAMESPACES: {
    EIP155: 'eip155'
  },
  CONNECTOR_STATUS: {
    READY: 'ready',
    CONNECTED: 'connected'
  }
}))

jest.mock('@web3auth/ethereum-provider', () => ({
  EthereumPrivateKeyProvider: jest.fn()
}))

jest.mock('@web3auth/wallet-services-plugin', () => ({
  WalletServicesPlugin: jest.fn()
}))

// Mock SDK
jest.mock('@conduit-ucpi/sdk', () => ({
  EscrowSDK: jest.fn().mockImplementation(() => ({
    connectWallet: jest.fn().mockResolvedValue(undefined),
    disconnectWallet: jest.fn().mockResolvedValue(undefined),
    isWalletConnected: jest.fn().mockReturnValue(true),
    getWalletAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
    getUSDCBalanceForAddress: jest.fn().mockResolvedValue('100.0'),
    getUSDCAllowance: jest.fn().mockResolvedValue('1000.0'),
    signUSDCTransfer: jest.fn().mockResolvedValue('mock-signed-transaction'),
    getContractInfo: jest.fn().mockResolvedValue({}),
    getContractState: jest.fn().mockResolvedValue({}),
    signContractTransaction: jest.fn().mockResolvedValue('mock-signed-transaction'),
    hashDescription: jest.fn().mockReturnValue('0x1234'),
    getUserAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    services: {
      user: {
        login: jest.fn().mockResolvedValue({ success: true }),
        logout: jest.fn().mockResolvedValue({ success: true }),
        getIdentity: jest.fn().mockResolvedValue({ success: true })
      },
      chain: {
        createContract: jest.fn().mockResolvedValue({ success: true }),
        raiseDispute: jest.fn().mockResolvedValue({ success: true }),
        claimFunds: jest.fn().mockResolvedValue({ success: true })
      },
      contracts: {
        create: jest.fn().mockResolvedValue({ success: true }),
        getById: jest.fn().mockResolvedValue({ success: true }),
        getAll: jest.fn().mockResolvedValue({ success: true })
      }
    },
    utils: {
      isValidEmail: jest.fn().mockReturnValue(true),
      isValidAmount: jest.fn().mockReturnValue(true),
      isValidDescription: jest.fn().mockReturnValue(true),
      isValidWalletAddress: jest.fn().mockReturnValue(true),
      formatCurrency: jest.fn().mockImplementation((amount, currency = 'microUSDC') => {
        let numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        
        // Smart conversion logic similar to SDK
        if (currency === 'microUSDC' || (currency === 'USDC' && numericAmount >= 1000)) {
          numericAmount = numericAmount / 1000000;
        }
        
        return { 
          amount: numericAmount.toFixed(4), 
          currency: 'USDC', 
          numericAmount: numericAmount 
        };
      }),
      formatUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return (num / 1000000).toFixed(4);
      }),
      toMicroUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return Math.round(num * 1000000);
      }),
      fromMicroUSDC: jest.fn().mockReturnValue(1.0),
      toUSDCForWeb3: jest.fn().mockReturnValue('1.0'),
      formatDateTimeWithTZ: jest.fn().mockReturnValue('2024-01-01T00:00:00-05:00'),
      formatDateTime: jest.fn().mockReturnValue('2024-01-01 00:00:00'),
      formatDate: jest.fn().mockReturnValue('2024-01-01'),
      formatTimestamp: jest.fn().mockReturnValue('2024-01-01 00:00:00'),
      formatTimeRemaining: jest.fn().mockReturnValue('in 1 day'),
      formatExpiryDate: jest.fn().mockReturnValue('2024-01-01'),
      isExpired: jest.fn().mockReturnValue(false),
      normalizeTimestamp: jest.fn().mockReturnValue(1704067200000)
    },
    getSDKInfo: jest.fn().mockReturnValue({ version: '0.1.0', name: '@conduit-ucpi/sdk' }),
    destroy: jest.fn()
  })),
  Config: jest.fn().mockImplementation((config) => config),
  ERC20_ABI: [],
  ESCROW_CONTRACT_ABI: []
}))

// SDKProvider was removed as part of auth system reorganization

// Mock SDK utils
jest.mock('./lib/sdk', () => ({
  SDK: jest.fn().mockImplementation(() => ({
    utils: {
        isValidEmail: jest.fn().mockReturnValue(true),
        isValidAmount: jest.fn().mockReturnValue(true),
        isValidDescription: jest.fn().mockReturnValue(true),
        formatCurrency: jest.fn().mockImplementation((amount, currency = 'microUSDC') => {
        let numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        
        // Smart conversion logic similar to SDK
        if (currency === 'microUSDC' || (currency === 'USDC' && numericAmount >= 1000)) {
          numericAmount = numericAmount / 1000000;
        }
        
        return { 
          amount: numericAmount.toFixed(4), 
          currency: 'USDC', 
          numericAmount: numericAmount 
        };
      }),
        formatUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return (num / 1000000).toFixed(4);
      }),
        toMicroUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return Math.round(num * 1000000);
      }),
        formatDateTimeWithTZ: jest.fn().mockReturnValue('2024-01-01T00:00:00-05:00'),
        toUSDCForWeb3: jest.fn().mockReturnValue('1.0')
      }
    },
    isInitialized: true,
    error: null
  })
}))

// Create a mock that can be overridden by individual tests
const createMockWeb3SDK = () => ({
  isReady: true,
  error: null,
  isConnected: true,
  getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
  getUSDCAllowance: jest.fn().mockResolvedValue('1000.0'),
  signUSDCTransfer: jest.fn().mockResolvedValue('mock-signed-transaction'),
  getContractInfo: jest.fn().mockResolvedValue({}),
  getContractState: jest.fn().mockResolvedValue({}),
  signContractTransaction: jest.fn().mockResolvedValue('mock-signed-transaction'),
  hashDescription: jest.fn().mockReturnValue('0x1234'),
  getUserAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    services: {
      user: { login: jest.fn(), logout: jest.fn(), getIdentity: jest.fn() },
      chain: { createContract: jest.fn(), raiseDispute: jest.fn(), claimFunds: jest.fn() },
      contracts: { create: jest.fn(), getById: jest.fn(), getAll: jest.fn() }
    },
    utils: {
      isValidEmail: jest.fn().mockReturnValue(true),
      isValidAmount: jest.fn().mockReturnValue(true),
      isValidDescription: jest.fn().mockReturnValue(true),
      formatCurrency: jest.fn().mockImplementation((amount, currency = 'microUSDC') => {
        let numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        
        // Smart conversion logic similar to SDK
        if (currency === 'microUSDC' || (currency === 'USDC' && numericAmount >= 1000)) {
          numericAmount = numericAmount / 1000000;
        }
        
        return { 
          amount: numericAmount.toFixed(4), 
          currency: 'USDC', 
          numericAmount: numericAmount 
        };
      }),
      formatUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return (num / 1000000).toFixed(4);
      }),
      toMicroUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return Math.round(num * 1000000);
      }),
      formatDateTimeWithTZ: jest.fn().mockReturnValue('2024-01-01T00:00:00-05:00'),
      toUSDCForWeb3: jest.fn().mockReturnValue('1.0')
    },
    sdk: null
});

// Mock useSimpleEthers hook (replacement for useWeb3SDK)
jest.mock('./hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    provider: null,
    isReady: true,
    getWeb3Service: jest.fn(),
    fundAndSendTransaction: jest.fn().mockResolvedValue('0xtxhash'),
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
    getNativeBalance: jest.fn().mockResolvedValue('1.0'),
    getUserAddress: jest.fn().mockResolvedValue('0xuser'),
  })
}))

// Mock WalletProvider
jest.mock('./lib/wallet/WalletProvider', () => ({
  WalletProvider: ({ children }) => children,
  useWallet: () => ({
    walletProvider: {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signTransaction: jest.fn().mockResolvedValue('mock-signed-transaction'),
      signMessage: jest.fn().mockResolvedValue('mock-signature'),
      request: jest.fn().mockResolvedValue([]),
      isConnected: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('Mock Wallet'),
      getEthersProvider: jest.fn().mockReturnValue({})
    },
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    isLoading: false
  })
}))

// Mock ResizeObserver for jsdom environment
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))