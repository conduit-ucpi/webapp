// Mock implementation of @wagmi/core for Jest tests

module.exports = {
  getAccount: () => ({
    isConnected: false,
    address: undefined,
    connector: null,
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getPublicClient: () => null,
  getWalletClient: () => null,
  switchChain: jest.fn(),
  readContract: jest.fn(),
  writeContract: jest.fn(),
  waitForTransaction: jest.fn(),
};