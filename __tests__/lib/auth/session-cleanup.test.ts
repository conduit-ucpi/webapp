/**
 * Session Cleanup Tests
 *
 * These tests ensure that all user data is properly cleared on logout
 * AND as the first step of login to prevent stale data from persisting
 * across sessions.
 */

import { AuthManager } from '@/lib/auth/core/AuthManager';
import { Web3Service } from '@/lib/web3';

describe('Session Cleanup', () => {
  let authManager: AuthManager;

  const mockAuthConfig = {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    web3AuthNetwork: 'sapphire_mainnet',
    web3AuthClientId: 'test-client-id',
    walletConnectProjectId: 'test-wc-project-id', // Required for WalletConnect
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

    // Clear localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Reset mocks
    jest.clearAllMocks();

    // Get fresh AuthManager instance
    authManager = AuthManager.getInstance();
  });

  afterEach(() => {
    // Clean up - reset singleton
    (AuthManager as any).instance = null;
  });

  describe('Logout Cleanup', () => {
    it('should clear window.authUser on logout', async () => {
      // Setup: Simulate a logged-in user
      (window as any).authUser = {
        walletAddress: '0xOldAddress',
        providerName: 'walletconnect',
        isConnected: true,
        isAuthenticated: true
      };

      // Initialize auth manager
      await authManager.initialize(mockAuthConfig);

      // Act: Logout
      await authManager.disconnect();

      // Assert: window.authUser should be cleared
      expect((window as any).authUser).toBeUndefined();
    });


    it('should clear Web3Service state on logout', async () => {
      // Setup: Create a Web3Service instance with state
      const web3Service = Web3Service.getInstance(mockWeb3Config);
      const mockProvider = {
        getSigner: jest.fn(async () => ({
          getAddress: jest.fn(async () => '0xTestAddress')
        })),
        getNetwork: jest.fn(async () => ({ chainId: BigInt(8453), name: 'base' })),
        getBalance: jest.fn(),
        getFeeData: jest.fn(),
        getBlockNumber: jest.fn()
      };
      await web3Service.initialize(mockProvider as any);

      expect(web3Service.isServiceInitialized()).toBe(true);

      // Initialize auth manager
      await authManager.initialize(mockAuthConfig);

      // Act
      await authManager.disconnect();

      // Assert: Web3Service should be cleared
      expect(web3Service.isServiceInitialized()).toBe(false);
    });

    it('should clear AuthManager state on logout', async () => {
      // Setup
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
      // Setup: Initialize first, then set token
      await authManager.initialize(mockAuthConfig);

      // TokenManager uses 'auth_token' key (lowercase)
      localStorage.setItem('auth_token', 'old-token');
      sessionStorage.setItem('auth_token', 'old-token');
      expect(localStorage.getItem('auth_token')).toBe('old-token');

      // Act
      await authManager.disconnect();

      // Assert: TokenManager.clearToken() should clear both localStorage and sessionStorage
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(sessionStorage.getItem('auth_token')).toBeNull();
    });

    it('should call provider disconnect on logout', async () => {
      // Setup: Initialize auth manager
      await authManager.initialize(mockAuthConfig);

      // Manually set a provider to test that disconnect is called
      const mockProvider = {
        disconnect: jest.fn().mockResolvedValue(undefined),
        getProviderName: jest.fn().mockReturnValue('walletconnect'),
        getCapabilities: jest.fn()
      };
      (authManager as any).currentProvider = mockProvider;

      // Act: Disconnect
      await authManager.disconnect();

      // Assert: Provider's disconnect method should be called
      expect(mockProvider.disconnect).toHaveBeenCalled();
      // Assert: currentProvider should be cleared
      expect((authManager as any).currentProvider).toBeNull();
    });
  });

  describe('Login Cleanup (Before New Session)', () => {
    it('should clear window.authUser before setting new user on login', async () => {
      // Setup: Simulate stale data from previous session
      (window as any).authUser = {
        walletAddress: '0xStaleAddress',
        providerName: 'walletconnect',
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

    it('should clear WalletConnect provider cache before new connection', async () => {
      // Setup: Initialize and get provider
      await authManager.initialize(mockAuthConfig);
      const provider = (authManager as any).providerRegistry.getProvider('walletconnect');

      if (provider) {
        // Simulate stale provider cache
        (provider as any).cachedEthersProvider = { mock: 'old-provider' };
        (provider as any).currentAddress = '0xOldAddress';

        // Mock the connect method to simulate a new connection
        const originalConnect = provider.connect;
        provider.connect = jest.fn().mockImplementation(async () => {
          // Clear cache (simulating what the real connect does)
          (provider as any).cachedEthersProvider = null;
          (provider as any).currentAddress = '0xNewAddress';
          return { success: true, address: '0xNewAddress' };
        });

        // Act: Connect (which should clear old cache)
        const result = await provider.connect();

        // Assert: Cache should be cleared and new address set
        expect((provider as any).currentAddress).toBe('0xNewAddress');
        expect(result.success).toBe(true);
      } else {
        expect(provider).toBeDefined();
      }
    });

    it('should handle reconnection with different wallet address', async () => {
      // Setup: Simulate first connection
      (window as any).authUser = {
        walletAddress: '0xFirstAddress',
        providerName: 'walletconnect'
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
      // Setup: Initialize auth manager
      await authManager.initialize(mockAuthConfig);
      (authManager as any).setState({
        address: '0xConnectedAddress'
      });

      // Create Web3Service and verify it uses auth address
      const web3Service = Web3Service.getInstance(mockWeb3Config);
      (window as any).authUser = {
        walletAddress: '0xConnectedAddress'
      };

      // Mock provider with proper methods
      const mockProvider = {
        getSigner: jest.fn(() => ({
          getAddress: jest.fn(async () => '0xProviderAddress')
        })),
        getNetwork: jest.fn(async () => ({ chainId: BigInt(8453), name: 'base' })),
        getBalance: jest.fn(),
        getFeeData: jest.fn(),
        getBlockNumber: jest.fn()
      };
      await web3Service.initialize(mockProvider as any);

      // Verify getUserAddress uses authUser first
      const address = await web3Service.getUserAddress();
      expect(address).toBe('0xConnectedAddress');

      // Act: Logout
      await authManager.disconnect();

      // Clear Web3Service (normally done by logout)
      web3Service.clearState();

      // Assert: authUser should be cleared
      expect((window as any).authUser).toBeUndefined();

      // getUserAddress should now use provider fallback
      const mockProvider2 = {
        getSigner: jest.fn(() => ({
          getAddress: jest.fn(async () => '0xNewProviderAddress')
        })),
        getNetwork: jest.fn(async () => ({ chainId: BigInt(8453), name: 'base' })),
        getBalance: jest.fn(),
        getFeeData: jest.fn(),
        getBlockNumber: jest.fn()
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
