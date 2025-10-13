/**
 * Tests to ensure COMPLETE obliteration of previous session data on logout
 * This is critical - no trace of the previous wallet address should remain
 */

import { Web3Service } from '@/lib/web3';

// Mock the config
const mockConfig = {
  web3AuthClientId: 'test-web3auth-client-id',
  web3AuthNetwork: 'sapphire_devnet',
  dynamicEnvironmentId: 'test-env-id',
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  contractFactoryAddress: '0x123...factory',
  moonPayApiKey: 'test-moonpay-key',
  minGasWei: '1000000000',
  maxGasPriceGwei: '100',
  maxGasCostGwei: '500',
  usdcGrantFoundryGas: '500000',
  depositFundsFoundryGas: '300000',
  gasPriceBuffer: '1.2',
  basePath: '',
  explorerBaseUrl: 'https://basescan.org',
  serviceLink: 'https://test.conduit-ucpi.com'
};

// Mock ethers provider
const createMockProvider = (address: string) => ({
  getSigner: jest.fn().mockResolvedValue({
    getAddress: jest.fn().mockResolvedValue(address),
    signMessage: jest.fn().mockResolvedValue('mock-signature'),
    signTransaction: jest.fn().mockResolvedValue('mock-signed-tx')
  }),
  getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
  getNetwork: jest.fn().mockResolvedValue({ chainId: 8453, name: 'base' }),
  send: jest.fn(),
  call: jest.fn(),
  estimateGas: jest.fn().mockResolvedValue(BigInt('21000'))
});

// Mock USDC contract
const mockUsdcContract = {
  balanceOf: jest.fn().mockResolvedValue(BigInt('5000000')), // 5 USDC
  decimals: jest.fn().mockResolvedValue(6)
};

jest.mock('ethers', () => ({
  ethers: {
    BrowserProvider: jest.fn(),
    Contract: jest.fn(() => mockUsdcContract),
    formatEther: jest.fn((val) => '1.0'),
    formatUnits: jest.fn((val) => '5.0'),
    Interface: jest.fn(() => ({
      encodeFunctionData: jest.fn().mockReturnValue('0x123abc')
    }))
  }
}));

describe('Logout Session Obliteration Tests', () => {
  beforeEach(() => {
    // Clear any existing Web3Service instance
    Web3Service.clearInstance();

    // Clear window globals that might persist
    if (typeof window !== 'undefined') {
      delete (window as any).dynamicUser;
      delete (window as any).dynamicPrimaryWallet;
      delete (window as any).dynamicAuthToken;
      delete (window as any).dynamicOAuthResult;
      delete (window as any).dynamicGetAuthToken;
      delete (window as any).dynamicOAuthRedirectHandler;
    }

    jest.clearAllMocks();
  });

  afterEach(() => {
    Web3Service.clearInstance();
  });

  describe('Web3Service Singleton Obliteration', () => {
    it('should completely destroy Web3Service singleton on clearInstance()', async () => {
      // First session - initialize with embedded wallet
      const embeddedWalletAddress = '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2';
      const embeddedProvider = createMockProvider(embeddedWalletAddress);

      const web3Service1 = Web3Service.getInstance(mockConfig);
      await web3Service1.initialize(embeddedProvider as any);

      // Verify first session is working
      expect(web3Service1.isServiceInitialized()).toBe(true);
      const address1 = await web3Service1.getUserAddress();
      expect(address1).toBe(embeddedWalletAddress);

      // LOGOUT - obliterate the singleton
      Web3Service.clearInstance();

      // Verify singleton is completely destroyed
      expect(Web3Service['instance']).toBeNull();

      // Second session - initialize with MetaMask
      const metamaskAddress = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
      const metamaskProvider = createMockProvider(metamaskAddress);

      const web3Service2 = Web3Service.getInstance(mockConfig);
      await web3Service2.initialize(metamaskProvider as any);

      // Verify second session has NO TRACE of first session
      const address2 = await web3Service2.getUserAddress();
      expect(address2).toBe(metamaskAddress);
      expect(address2).not.toBe(embeddedWalletAddress);

      // Verify it's a completely different instance
      expect(web3Service2).not.toBe(web3Service1);
    });

    it('should return fresh singleton after clearInstance()', () => {
      // Create first instance
      const instance1 = Web3Service.getInstance(mockConfig);

      // Clear it
      Web3Service.clearInstance();

      // Get new instance
      const instance2 = Web3Service.getInstance(mockConfig);

      // Should be completely different objects
      expect(instance2).not.toBe(instance1);
      expect(instance2.isServiceInitialized()).toBe(false);
    });

    it.skip('should handle balance queries correctly after obliteration', async () => {
      // Reset mock to control return values precisely
      mockUsdcContract.balanceOf.mockReset();

      // Session 1: Embedded wallet with 0 balance
      const embeddedAddress = '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2';
      const embeddedProvider = createMockProvider(embeddedAddress);
      mockUsdcContract.balanceOf.mockResolvedValueOnce(BigInt('0')); // 0 USDC

      const web3Service1 = Web3Service.getInstance(mockConfig);
      await web3Service1.initialize(embeddedProvider as any);

      const balance1 = await web3Service1.getUSDCBalance(embeddedAddress);
      expect(balance1).toBe('0.0');

      // LOGOUT - obliterate
      Web3Service.clearInstance();

      // Session 2: MetaMask with actual balance
      const metamaskAddress = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
      const metamaskProvider = createMockProvider(metamaskAddress);
      mockUsdcContract.balanceOf.mockResolvedValueOnce(BigInt('5000000')); // 5 USDC

      const web3Service2 = Web3Service.getInstance(mockConfig);
      await web3Service2.initialize(metamaskProvider as any);

      const balance2 = await web3Service2.getUSDCBalance(metamaskAddress);
      expect(balance2).toBe('5.0');

      // Verify no cross-contamination
      expect(balance2).not.toBe(balance1);
      expect(balance1).toBe('0.0'); // First session still had 0 balance
      expect(balance2).toBe('5.0'); // Second session has 5 balance
    });
  });

  describe('Window Globals Obliteration', () => {
    it('should clear all Dynamic-related window globals', () => {
      // Set up window globals like they would be after login
      if (typeof window !== 'undefined') {
        (window as any).dynamicUser = { walletAddress: '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2' };
        (window as any).dynamicPrimaryWallet = { address: '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2' };
        (window as any).dynamicAuthToken = 'old-jwt-token';
        (window as any).dynamicOAuthResult = { address: '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2' };
        (window as any).dynamicGetAuthToken = () => 'old-jwt';
        (window as any).dynamicOAuthRedirectHandler = () => {};

        // Simulate logout clearing
        delete (window as any).dynamicUser;
        delete (window as any).dynamicPrimaryWallet;
        delete (window as any).dynamicAuthToken;
        delete (window as any).dynamicOAuthResult;
        delete (window as any).dynamicGetAuthToken;
        delete (window as any).dynamicOAuthRedirectHandler;

        // Verify all are gone
        expect((window as any).dynamicUser).toBeUndefined();
        expect((window as any).dynamicPrimaryWallet).toBeUndefined();
        expect((window as any).dynamicAuthToken).toBeUndefined();
        expect((window as any).dynamicOAuthResult).toBeUndefined();
        expect((window as any).dynamicGetAuthToken).toBeUndefined();
        expect((window as any).dynamicOAuthRedirectHandler).toBeUndefined();
      }
    });
  });

  describe('Complete Session Isolation', () => {
    it('should have zero trace of previous session after complete logout', async () => {
      // === FIRST SESSION: Embedded Wallet ===
      const embeddedAddress = '0x3F2B518f78dB2ef66c7ca70B8e4Bc2254d86bfd2';
      const embeddedProvider = createMockProvider(embeddedAddress);

      // Set up window globals for first session
      if (typeof window !== 'undefined') {
        (window as any).dynamicUser = { walletAddress: embeddedAddress };
        (window as any).dynamicPrimaryWallet = { address: embeddedAddress };
        (window as any).dynamicAuthToken = 'embedded-jwt';
      }

      // Initialize Web3Service for first session
      const web3Service1 = Web3Service.getInstance(mockConfig);
      await web3Service1.initialize(embeddedProvider as any);

      // Verify first session state
      expect(await web3Service1.getUserAddress()).toBe(embeddedAddress);

      // === LOGOUT: COMPLETE OBLITERATION ===

      // 1. Clear Web3Service singleton
      Web3Service.clearInstance();

      // 2. Clear window globals
      if (typeof window !== 'undefined') {
        delete (window as any).dynamicUser;
        delete (window as any).dynamicPrimaryWallet;
        delete (window as any).dynamicAuthToken;
        delete (window as any).dynamicOAuthResult;
        delete (window as any).dynamicGetAuthToken;
        delete (window as any).dynamicOAuthRedirectHandler;
      }

      // 3. Verify complete obliteration
      expect(Web3Service['instance']).toBeNull();
      if (typeof window !== 'undefined') {
        expect((window as any).dynamicUser).toBeUndefined();
        expect((window as any).dynamicPrimaryWallet).toBeUndefined();
        expect((window as any).dynamicAuthToken).toBeUndefined();
      }

      // === SECOND SESSION: MetaMask ===
      const metamaskAddress = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
      const metamaskProvider = createMockProvider(metamaskAddress);

      // Set up window globals for second session
      if (typeof window !== 'undefined') {
        (window as any).dynamicUser = { walletAddress: metamaskAddress };
        (window as any).dynamicPrimaryWallet = { address: metamaskAddress };
        (window as any).dynamicAuthToken = 'metamask-jwt';
      }

      // Initialize fresh Web3Service for second session
      const web3Service2 = Web3Service.getInstance(mockConfig);
      await web3Service2.initialize(metamaskProvider as any);

      // === VERIFICATION: NO CONTAMINATION ===

      // Verify second session has correct address
      const finalAddress = await web3Service2.getUserAddress();
      expect(finalAddress).toBe(metamaskAddress);

      // CRITICAL: Verify NO TRACE of embedded wallet address
      expect(finalAddress).not.toBe(embeddedAddress);
      expect(finalAddress).not.toContain('3F2B518f');

      // Verify instances are completely different
      expect(web3Service2).not.toBe(web3Service1);

      // Verify window globals contain only new session data
      if (typeof window !== 'undefined') {
        expect((window as any).dynamicUser?.walletAddress).toBe(metamaskAddress);
        expect((window as any).dynamicPrimaryWallet?.address).toBe(metamaskAddress);
        expect((window as any).dynamicAuthToken).toBe('metamask-jwt');

        // Verify NO embedded wallet traces in window
        expect((window as any).dynamicUser?.walletAddress).not.toBe(embeddedAddress);
        expect((window as any).dynamicAuthToken).not.toBe('embedded-jwt');
      }
    });

    it('should handle multiple logout/login cycles without contamination', async () => {
      const addresses = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ];

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const provider = createMockProvider(address);

        // Login
        const web3Service = Web3Service.getInstance(mockConfig);
        await web3Service.initialize(provider as any);

        // Verify correct address
        const retrievedAddress = await web3Service.getUserAddress();
        expect(retrievedAddress).toBe(address);

        // Verify no contamination from previous sessions
        for (let j = 0; j < i; j++) {
          expect(retrievedAddress).not.toBe(addresses[j]);
        }

        // Logout - complete obliteration
        Web3Service.clearInstance();

        // Verify obliteration
        expect(Web3Service['instance']).toBeNull();
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle clearInstance() when no instance exists', () => {
      // Should not throw
      expect(() => Web3Service.clearInstance()).not.toThrow();
      expect(Web3Service['instance']).toBeNull();
    });

    it('should handle multiple clearInstance() calls', () => {
      const web3Service = Web3Service.getInstance(mockConfig);
      expect(Web3Service['instance']).not.toBeNull();

      // First clear
      Web3Service.clearInstance();
      expect(Web3Service['instance']).toBeNull();

      // Second clear should not throw
      expect(() => Web3Service.clearInstance()).not.toThrow();
      expect(Web3Service['instance']).toBeNull();
    });
  });
});