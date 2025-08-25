const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock Wagmi and related ES modules
    '^wagmi$': '<rootDir>/__mocks__/wagmi.js',
    '^wagmi/chains$': '<rootDir>/__mocks__/wagmi-chains.js',
    '^wagmi/(.*)$': '<rootDir>/__mocks__/wagmi.js',
    '^@wagmi/core$': '<rootDir>/__mocks__/wagmi-core.js',
    '^@wagmi/connectors$': '<rootDir>/__mocks__/wagmi-connectors.js',
    '^@wagmi/chains$': '<rootDir>/__mocks__/wagmi-chains.js',
    '^viem$': '<rootDir>/__mocks__/viem.js',
    '^viem/(.*)$': '<rootDir>/__mocks__/viem.js',
    '^@tanstack/react-query$': '<rootDir>/__mocks__/tanstack-react-query.js',
  },
  // Increase timeout for Web3Auth crypto operations
  testTimeout: 30000,
  // Reduce concurrent workers to prevent crypto conflicts
  maxWorkers: 2,
  // Add additional configuration for better stability
  workerIdleMemoryLimit: '1GB',
}

module.exports = createJestConfig(customJestConfig)