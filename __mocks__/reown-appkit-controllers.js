/**
 * Mock for @reown/appkit-controllers
 * Used in Jest tests to avoid ESM parsing issues
 */

export const SIWXUtil = {
  getSIWX: jest.fn(),
  initializeIfEnabled: jest.fn(),
  isAuthenticated: jest.fn(),
  requestSignMessage: jest.fn(),
  cancelSignMessage: jest.fn(),
  getAllSessions: jest.fn(() => Promise.resolve([])),
  getSessions: jest.fn(() => Promise.resolve([])),
  isSIWXCloseDisabled: jest.fn(),
  authConnectorAuthenticate: jest.fn(),
  addEmbeddedWalletSession: jest.fn(),
  universalProviderAuthenticate: jest.fn(),
  getSIWXEventProperties: jest.fn(() => ({
    network: 'base',
    isSmartAccount: false,
    message: undefined
  })),
  clearSessions: jest.fn()
};

export default { SIWXUtil };
