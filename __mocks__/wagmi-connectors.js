// Mock implementation of @wagmi/connectors for Jest tests

module.exports = {
  injected: () => ({
    id: 'injected',
    name: 'Injected',
    type: 'injected',
  }),
  metaMask: () => ({
    id: 'metaMask',
    name: 'MetaMask',
    type: 'metaMask',
  }),
  walletConnect: () => ({
    id: 'walletConnect',
    name: 'WalletConnect',
    type: 'walletConnect',
  }),
};