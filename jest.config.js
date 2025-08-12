const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Increase timeout for Web3Auth crypto operations
  testTimeout: 30000,
  // Reduce concurrent workers to prevent crypto conflicts
  maxWorkers: 2,
  // Add additional configuration for better stability
  workerIdleMemoryLimit: '1GB',
}

module.exports = createJestConfig(customJestConfig)