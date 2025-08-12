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
  }))
}))

jest.mock('@web3auth/base', () => ({
  CHAIN_NAMESPACES: {
    EIP155: 'eip155'
  }
}))

jest.mock('@web3auth/ethereum-provider', () => ({
  EthereumPrivateKeyProvider: jest.fn()
}))

jest.mock('@web3auth/wallet-services-plugin', () => ({
  WalletServicesPlugin: jest.fn()
}))