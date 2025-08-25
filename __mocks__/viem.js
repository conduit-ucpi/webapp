// Mock implementation of viem for Jest tests

module.exports = {
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
    getBlock: jest.fn(),
    getBlockNumber: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionReceipt: jest.fn(),
  })),
  createWalletClient: jest.fn(() => ({
    writeContract: jest.fn(),
    sendTransaction: jest.fn(),
    signMessage: jest.fn(),
  })),
  http: jest.fn(() => ({})),
  parseEther: jest.fn((value) => BigInt(value) * BigInt(10 ** 18)),
  formatEther: jest.fn((value) => (Number(value) / 10 ** 18).toString()),
  parseUnits: jest.fn((value, decimals) => BigInt(value) * BigInt(10 ** decimals)),
  formatUnits: jest.fn((value, decimals) => (Number(value) / 10 ** decimals).toString()),
  getContract: jest.fn(() => ({
    read: {},
    write: {},
  })),
  encodeFunctionData: jest.fn(),
  decodeFunctionResult: jest.fn(),
  isAddress: jest.fn(() => true),
  getAddress: jest.fn((address) => address),
  zeroAddress: '0x0000000000000000000000000000000000000000',
};