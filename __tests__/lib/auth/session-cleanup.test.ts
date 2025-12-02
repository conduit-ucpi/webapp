/**
 * Session Cleanup Tests
 *
 * These tests ensure that all user data is properly cleared on logout
 * AND as the first step of login to prevent stale data from persisting
 * across sessions.
 */

import { AuthManager } from '@/lib/auth/core/AuthManager';
import { DynamicProvider } from '@/lib/auth/providers/DynamicProvider';
import { Web3Service } from '@/lib/web3';

describe('Session Cleanup', () => {
  let authManager: AuthManager;

  const mockAuthConfig = {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    web3AuthNetwork: 'sapphire_mainnet',
    web3AuthClientId: 'test-client-id',
    dynamicEnvironmentId: 'test-dynamic-env-id',
    usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdtContractAddress: '0xUSDT'
  };

  const mockWeb3Config = {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    contractFactoryAddress: '0xFactory',
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'sapphire_mainnet',
    moonPayApiKey: 'test-key',
    explorerBaseUrl: 'https://basescan.org',
    maxGasPriceGwei: '100',
    maxGasCostGwei: '1000',
    usdcGrantFoundryGas: '100000',
    depositFundsFoundryGas: '100000',
    gasPriceBuffer: '1.5',
    minGasWei: '1',
    basePath: '',
    serviceLink: 'https://test.conduit-ucpi.com'
  };

  beforeEach(() => {
    // Clear window state before each test
    delete (window as any).authUser;
    delete (window as any).dynamicUser;
    delete (window as any).dynamicWallet;
    delete (window as any).dynamicOAuthResult;
    delete (window as any).dynamicAuthToken;
    delete (window as any).dynamicGetAuthToken;
    delete (window as any).dynamicLogin;
    delete (window as any).dynamicLogout;

    // Clear localStorage
    localStorage.clear();

    // Get fresh AuthManager instance
    authManager = AuthManager.getInstance();
  });

  afterEach(() => {
    // Clean up
    DynamicProvider.clearInstance();
  });

  describe('Logout Cleanup', () => {
    it('should clear window.authUser on logout', async () => {
      // Setup: Simulate a logged-in user
      (window as any).authUser = {
        walletAddress: '0xOldAddress',
        providerName: 'dynamic',
        isConnected: true,
        isAuthenticated: true
      };

      // Mock dynamicLogout
      (window as any).dynamicLogout = jest.fn(async () => {
        // Simulate Dynamic SDK cleanup
        delete (window as any).dynamicUser;
        delete (window as any).dynamicWallet;
      });

      // Initialize auth manager
      await authManager.initialize(mockAuthConfig);

      // Act: Logout
      await authManager.disconnect();

      // Assert: window.authUser should be cleared
      expect((window as any).authUser).toBeUndefined();
    });

    it('should clear window.dynamicUser on logout', async () => {
      // Setup
      (window as any).dynamicUser = {
        email: 'old@example.com',
        walletAddress: '0xOldAddress'
      };
      (window as any).dynamicLogout = jest.fn(async () => {
        delete (window as any).dynamicUser;
      });

      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert
      expect((window as any).dynamicUser).toBeUndefined();
    });

    it('should clear window.dynamicWallet on logout', async () => {
      // Setup
      (window as any).dynamicWallet = {
        address: '0xOldAddress',
        connector: {}
      };
      (window as any).dynamicLogout = jest.fn(async () => {
        delete (window as any).dynamicWallet;
      });

      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert
      expect((window as any).dynamicWallet).toBeUndefined();
    });

    it('should clear window.dynamicOAuthResult on logout', async () => {
      // Setup
      (window as any).dynamicOAuthResult = {
        address: '0xOldAddress',
        wallet: {}
      };
      (window as any).dynamicLogout = jest.fn(async () => {});

      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert
      expect((window as any).dynamicOAuthResult).toBeUndefined();
    });

    it('should clear Web3Service state on logout', async () => {
      // Setup: Create a Web3Service instance with state
      const web3Service = Web3Service.getInstance(mockWeb3Config);
      const mockProvider = {
        getSigner: jest.fn(),
        getNetwork: jest.fn(),
        getBalance: jest.fn()
      };
      await web3Service.initialize(mockProvider as any);

      expect(web3Service.isServiceInitialized()).toBe(true);

      (window as any).dynamicLogout = jest.fn(async () => {});
      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert: Web3Service should be cleared
      expect(web3Service.isServiceInitialized()).toBe(false);
    });

    it('should clear AuthManager state on logout', async () => {
      // Setup
      (window as any).dynamicLogout = jest.fn(async () => {});
      await authManager.initialize(mockAuthConfig);

      // Simulate connected state
      const state = authManager.getState();
      expect(state.isInitialized).toBe(true);

      // Manually set connected state (normally done by connect())
      (authManager as any).setState({
        isConnected: true,
        isAuthenticated: true,
        address: '0xOldAddress'
      });

      expect(authManager.getState().isConnected).toBe(true);
      expect(authManager.getState().address).toBe('0xOldAddress');

      // Act
      await authManager.disconnect();

      // Assert
      const loggedOutState = authManager.getState();
      expect(loggedOutState.isConnected).toBe(false);
      expect(loggedOutState.isAuthenticated).toBe(false);
      expect(loggedOutState.address).toBeNull();
    });

    it('should clear tokens on logout', async () => {
      // Setup
      localStorage.setItem('AUTH-TOKEN', 'old-token');
      (window as any).dynamicLogout = jest.fn(async () => {});

      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert
      expect(localStorage.getItem('AUTH-TOKEN')).toBeNull();
    });

    it('should clear DynamicProvider cached state on logout', async () => {
      // Setup: Create a DynamicProvider with cached state
      const provider = DynamicProvider.getInstance(mockAuthConfig);

      // Simulate cached provider state
      (provider as any).cachedEthersProvider = { mock: 'provider' };
      (provider as any).cachedProviderVersion = 'v1';
      (provider as any).currentAddress = '0xOldAddress';
      (provider as any).dynamicWallet = { mock: 'wallet' };

      expect((provider as any).cachedEthersProvider).toBeTruthy();
      expect((provider as any).currentAddress).toBe('0xOldAddress');
      expect((provider as any).dynamicWallet).toBeTruthy();

      (window as any).dynamicLogout = jest.fn(async () => {});

      // Act
      await provider.disconnect();

      // Assert: All cached state should be cleared
      expect((provider as any).cachedEthersProvider).toBeNull();
      expect((provider as any).cachedProviderVersion).toBeNull();
      expect((provider as any).currentAddress).toBeNull();
      expect((provider as any).dynamicWallet).toBeNull();
    });
  });

  describe('Login Cleanup (Before New Session)', () => {
    it('should clear window.authUser before setting new user on login', async () => {
      // Setup: Simulate stale data from previous session
      (window as any).authUser = {
        walletAddress: '0xStaleAddress',
        providerName: 'dynamic',
        isConnected: false,
        isAuthenticated: false
      };

      await authManager.initialize(mockAuthConfig);

      // Simulate a new login (setState with new address)
      (authManager as any).setState({
        isConnected: true,
        isAuthenticated: true,
        address: '0xNewAddress'
      });

      // Assert: New address should replace old one
      const authUser = (window as any).authUser;
      expect(authUser).toBeDefined();
      expect(authUser.walletAddress).toBe('0xNewAddress');
      expect(authUser.isConnected).toBe(true);
      expect(authUser.isAuthenticated).toBe(true);
    });

    it('should clear DynamicProvider cache before new connection', async () => {
      // Setup: Simulate stale provider cache
      const provider = DynamicProvider.getInstance(mockAuthConfig);
      (provider as any).cachedEthersProvider = { mock: 'old-provider' };
      (provider as any).currentAddress = '0xOldAddress';
      (provider as any).dynamicWallet = { mock: 'old-wallet' };

      // Mock Dynamic login
      (window as any).dynamicLogin = jest.fn(async () => ({
        address: '0xNewAddress',
        wallet: { mock: 'new-wallet' }
      }));

      // Act: Connect (which should clear old cache)
      const result = await provider.connect();

      // Assert: Old cache should be cleared and new connection established
      expect(result.success).toBe(true);
      expect(result.address).toBe('0xNewAddress');
      expect((provider as any).currentAddress).toBe('0xNewAddress');
    });

    it('should handle reconnection with different wallet address', async () => {
      // Setup: Simulate first connection
      (window as any).authUser = {
        walletAddress: '0xFirstAddress',
        providerName: 'dynamic'
      };

      await authManager.initialize(mockAuthConfig);

      (authManager as any).setState({
        address: '0xFirstAddress'
      });

      expect((window as any).authUser.walletAddress).toBe('0xFirstAddress');

      // Act: Simulate reconnection with different address
      (authManager as any).setState({
        address: '0xSecondAddress'
      });

      // Assert: New address should be set
      expect((window as any).authUser.walletAddress).toBe('0xSecondAddress');
    });

    it('should clear window.authUser when disconnecting (setting address to null)', async () => {
      // Setup: User is connected
      await authManager.initialize(mockAuthConfig);
      (authManager as any).setState({
        address: '0xConnectedAddress'
      });

      expect((window as any).authUser).toBeDefined();
      expect((window as any).authUser.walletAddress).toBe('0xConnectedAddress');

      // Act: Disconnect by setting address to null
      (authManager as any).setState({
        address: null,
        isConnected: false
      });

      // Assert: window.authUser should be cleared
      expect((window as any).authUser).toBeUndefined();
    });
  });

  describe('Comprehensive Cleanup Verification', () => {
    it('should ensure no stale data persists after logout and new login cycle', async () => {
      // Setup: First session
      (window as any).dynamicLogout = jest.fn(async () => {
        delete (window as any).dynamicUser;
        delete (window as any).dynamicWallet;
      });

      (window as any).dynamicLogin = jest.fn(async () => ({
        address: '0xNewAddress',
        wallet: { mock: 'new-wallet' }
      }));

      await authManager.initialize(mockAuthConfig);

      // Simulate first login
      (authManager as any).setState({
        isConnected: true,
        isAuthenticated: true,
        address: '0xFirstAddress'
      });

      expect((window as any).authUser).toBeDefined();
      expect((window as any).authUser.walletAddress).toBe('0xFirstAddress');

      // Act: Logout
      await authManager.disconnect();

      // Verify all cleanup
      expect((window as any).authUser).toBeUndefined();
      expect((window as any).dynamicUser).toBeUndefined();
      expect((window as any).dynamicWallet).toBeUndefined();
      expect((window as any).dynamicOAuthResult).toBeUndefined();
      expect(authManager.getState().isConnected).toBe(false);
      expect(authManager.getState().address).toBeNull();

      // Simulate second login with different address
      (authManager as any).setState({
        isConnected: true,
        isAuthenticated: true,
        address: '0xSecondAddress'
      });

      // Assert: Only new address should be present
      expect((window as any).authUser).toBeDefined();
      expect((window as any).authUser.walletAddress).toBe('0xSecondAddress');
      expect(authManager.getState().address).toBe('0xSecondAddress');
    });

    it('should not leak address from getUserAddress after logout', async () => {
      // Setup
      await authManager.initialize(mockAuthConfig);
      (authManager as any).setState({
        address: '0xConnectedAddress'
      });

      // Create Web3Service and verify it uses auth address
      const web3Service = Web3Service.getInstance(mockWeb3Config);
      (window as any).authUser = {
        walletAddress: '0xConnectedAddress'
      };

      // Mock provider
      const mockProvider = {
        getSigner: jest.fn(() => ({
          getAddress: jest.fn(async () => '0xProviderAddress')
        }))
      };
      await web3Service.initialize(mockProvider as any);

      // Verify getUserAddress uses authUser first
      const address = await web3Service.getUserAddress();
      expect(address).toBe('0xConnectedAddress');

      // Act: Logout
      (window as any).dynamicLogout = jest.fn(async () => {});
      await authManager.disconnect();

      // Clear Web3Service (normally done by logout)
      web3Service.clearState();

      // Assert: authUser should be cleared
      expect((window as any).authUser).toBeUndefined();

      // getUserAddress should now fail or use provider fallback
      const mockProvider2 = {
        getSigner: jest.fn(() => ({
          getAddress: jest.fn(async () => '0xNewProviderAddress')
        }))
      };
      await web3Service.initialize(mockProvider2 as any);

      const newAddress = await web3Service.getUserAddress();
      // Without authUser, it should use provider
      expect(newAddress).toBe('0xNewProviderAddress');
      // Importantly, it should NOT return the old address
      expect(newAddress).not.toBe('0xConnectedAddress');
    });
  });
});
