/**
 * Tests for Dynamic embedded wallet detection on the /wallet page
 *
 * This test ensures we correctly identify Dynamic embedded wallets
 * and show the appropriate wallet management UI.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock types
interface MockAuthState {
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  address: string | null;
  providerName: string | null;
  capabilities: any;
  error: string | null;
}

interface MockUser {
  userId: string;
  email?: string;
  walletAddress: string;
}

interface MockDynamicWallet {
  key: string;
  address: string;
  connector?: {
    name?: string;
    key?: string;
  };
}

interface MockDynamicContext {
  primaryWallet?: MockDynamicWallet | null;
  user?: any;
}

/**
 * Helper function to create mock auth state
 */
function createMockAuthState(overrides?: Partial<MockAuthState>): MockAuthState {
  return {
    isConnected: true,
    isLoading: false,
    isInitialized: true,
    isAuthenticated: true,
    address: '0x1234567890123456789012345678901234567890',
    providerName: 'dynamic',
    capabilities: {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    },
    error: null,
    ...overrides
  };
}

/**
 * Helper function to create mock user
 */
function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    userId: 'test-user-id',
    email: 'test@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    ...overrides
  };
}

/**
 * Helper function to create mock Dynamic context
 */
function createMockDynamicContext(overrides?: Partial<MockDynamicContext>): MockDynamicContext {
  return {
    primaryWallet: {
      key: 'dynamicembeddedwallet',
      address: '0x1234567890123456789012345678901234567890',
      connector: {
        name: 'Dynamic Embedded Wallet',
        key: 'dynamic-embedded'
      }
    },
    user: {
      email: 'test@example.com'
    },
    ...overrides
  };
}

/**
 * Extracted wallet detection logic from pages/wallet.tsx
 * This is the function we're testing
 */
function isDynamicEmbeddedWallet(
  user: MockUser | null,
  state: MockAuthState | null,
  dynamicContext: MockDynamicContext | null
): boolean {
  // First check: user must be authenticated and state must indicate dynamic provider
  if (!user || !state || state.providerName !== 'dynamic') {
    return false;
  }

  // Check if they're using an embedded wallet by looking at the Dynamic context
  const primaryWallet = dynamicContext?.primaryWallet;
  if (!primaryWallet) {
    return false;
  }

  // Get connector info
  const connector = primaryWallet.connector;

  // Dynamic embedded wallets typically have a specific connector type
  const isEmbeddedWallet = connector?.name?.toLowerCase().includes('embedded') ||
                         connector?.key?.toLowerCase().includes('embedded') ||
                         primaryWallet.key?.toLowerCase().includes('embedded') ||
                         primaryWallet.key?.toLowerCase().includes('dynamic');

  return isEmbeddedWallet;
}

describe('Dynamic Embedded Wallet Detection', () => {

  describe('isDynamicEmbeddedWallet function', () => {

    test('should return true for Dynamic embedded wallet with embedded connector name', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'dynamicembeddedwallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Dynamic Embedded Wallet',
            key: 'dynamic-embedded'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });

    test('should return true for Dynamic embedded wallet with embedded connector key', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'dynamic-wallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Dynamic',
            key: 'embedded-wallet'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });

    test('should return true for Dynamic embedded wallet with embedded wallet key', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'embedded-wallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Dynamic',
            key: 'dynamic'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });

    test('should return true for Dynamic wallet key containing "dynamic"', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'dynamicsocialwallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Social Login',
            key: 'social'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });

    test('should return false for external wallet (MetaMask)', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'metamask',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'MetaMask',
            key: 'metamask'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false for external wallet (Coinbase)', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'coinbasewallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Coinbase Wallet',
            key: 'coinbase'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false for WalletConnect', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'walletconnect',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'WalletConnect',
            key: 'walletconnect'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when user is null', () => {
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext();

      const result = isDynamicEmbeddedWallet(null, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when state is null', () => {
      const user = createMockUser();
      const dynamicContext = createMockDynamicContext();

      const result = isDynamicEmbeddedWallet(user, null, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when providerName is not "dynamic"', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'walletconnect' });
      const dynamicContext = createMockDynamicContext();

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when providerName is null', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: null });
      const dynamicContext = createMockDynamicContext();

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when Dynamic context has no primary wallet', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: null
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should return false when Dynamic context is null', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });

      const result = isDynamicEmbeddedWallet(user, state, null);

      expect(result).toBe(false);
    });

    test('should handle case-insensitive matching for connector names', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'test-wallet',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'EMBEDDED Wallet',
            key: 'test'
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });

    test('should handle wallet with no connector object', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'external-wallet',
          address: '0x1234567890123456789012345678901234567890'
          // No connector object
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should detect embedded wallet even if connector name and key are empty but wallet key indicates embedded', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });
      const dynamicContext = createMockDynamicContext({
        primaryWallet: {
          key: 'dynamicembedded',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: '',
            key: ''
          }
        }
      });

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });
  });

  describe('Edge cases and real-world scenarios', () => {

    test('should handle Farcaster wallet (non-Dynamic)', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'farcaster' });
      const dynamicContext = null; // Farcaster doesn't use Dynamic context

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(false);
    });

    test('should handle user switching from external wallet to embedded wallet', () => {
      const user = createMockUser();
      const state = createMockAuthState({ providerName: 'dynamic' });

      // First with external wallet
      const externalContext = createMockDynamicContext({
        primaryWallet: {
          key: 'metamask',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'MetaMask',
            key: 'metamask'
          }
        }
      });

      expect(isDynamicEmbeddedWallet(user, state, externalContext)).toBe(false);

      // Then with embedded wallet
      const embeddedContext = createMockDynamicContext({
        primaryWallet: {
          key: 'dynamicembedded',
          address: '0x9876543210987654321098765432109876543210',
          connector: {
            name: 'Dynamic Embedded',
            key: 'embedded'
          }
        }
      });

      expect(isDynamicEmbeddedWallet(user, state, embeddedContext)).toBe(true);
    });

    test('should handle session restoration with embedded wallet', () => {
      const user = createMockUser();
      const state = createMockAuthState({
        providerName: 'dynamic',
        isConnected: true,
        isAuthenticated: true
      });
      const dynamicContext = createMockDynamicContext();

      const result = isDynamicEmbeddedWallet(user, state, dynamicContext);

      expect(result).toBe(true);
    });
  });
});
