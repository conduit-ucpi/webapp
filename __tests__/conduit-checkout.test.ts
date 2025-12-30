/**
 * Comprehensive tests for conduit-checkout.js SDK
 * Tests payment verification, polling logic, and security checks
 */

import * as fs from 'fs';
import * as path from 'path';

describe('ConduitCheckout SDK', () => {
  let ConduitCheckout: any;
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;
  let windowMock: any;

  beforeAll(() => {
    // Load the SDK code
    const sdkPath = path.join(__dirname, '../public/conduit-checkout.js');
    const sdkCode = fs.readFileSync(sdkPath, 'utf8');

    // Create a mock window object
    windowMock = {
      location: { href: 'https://merchant.example.com' },
      screen: { width: 1920, height: 1080 },
      open: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      URL: global.URL,
    };

    // Execute SDK in mock window context
    const func = new Function('window', sdkCode + '\nreturn window.ConduitCheckout;');
    ConduitCheckout = func(windowMock);
  });

  beforeEach(() => {
    // Reset SDK state before each test
    ConduitCheckout.config = {
      sellerAddress: null,
      baseUrl: null,
      tokenSymbol: 'USDC',
      expiryDays: 7,
      mode: 'popup',
      verifyPayment: true,
      verificationTimeout: 30000,
      verificationInterval: 2000,
      onSuccess: jest.fn(),
      onError: jest.fn(),
      onCancel: jest.fn(),
      onVerifying: null,
    };
    ConduitCheckout.popup = null;
    ConduitCheckout.messageListener = null;
    ConduitCheckout.currentPayment = null;

    // Mock fetch
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;

    // Use fake timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should require sellerAddress', () => {
      expect(() => {
        ConduitCheckout.init({
          baseUrl: 'https://app.example.com',
        });
      }).toThrow('sellerAddress is required');
    });

    it('should require baseUrl', () => {
      expect(() => {
        ConduitCheckout.init({
          sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        });
      }).toThrow('baseUrl is required');
    });

    it('should initialize with correct defaults', () => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });

      expect(ConduitCheckout.config.sellerAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(ConduitCheckout.config.baseUrl).toBe('https://app.example.com');
      expect(ConduitCheckout.config.tokenSymbol).toBe('USDC');
      expect(ConduitCheckout.config.verifyPayment).toBe(true);
      expect(ConduitCheckout.config.verificationTimeout).toBe(30000);
      expect(ConduitCheckout.config.verificationInterval).toBe(2000);
    });

    it('should remove trailing slash from baseUrl', () => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com/',
      });

      expect(ConduitCheckout.config.baseUrl).toBe('https://app.example.com');
    });

    it('should allow custom verification settings', () => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
        verifyPayment: false,
        verificationTimeout: 60000,
        verificationInterval: 1000,
      });

      expect(ConduitCheckout.config.verifyPayment).toBe(false);
      expect(ConduitCheckout.config.verificationTimeout).toBe(60000);
      expect(ConduitCheckout.config.verificationInterval).toBe(1000);
    });
  });

  describe('Payment Verification', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
        verificationTimeout: 10000,
        verificationInterval: 1000,
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        description: 'Test Product',
        tokenSymbol: 'USDC',
      };
    });

    it('should verify payment successfully with ACTIVE state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            chainAddress: '0xcontract123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            currencySymbol: 'USDC',
            description: 'Test Product',
            state: 'ACTIVE',
          }],
        }),
      });

      const result = await ConduitCheckout.verifyPayment('abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.example.com/api/results',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
          }),
        })
      );

      expect(result).toMatchObject({
        contractId: 'abc123',
        seller: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 50.0,
        currencySymbol: 'USDC',
        state: 'ACTIVE',
        verified: true,
      });
    });

    it('should accept all verified states', async () => {
      const verifiedStates = ['ACTIVE', 'COMPLETED', 'CLAIMED', 'RESOLVED', 'DISPUTED'];

      for (const state of verifiedStates) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              chainAddress: '0xcontract123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state,
            }],
          }),
        });

        const result = await ConduitCheckout.verifyPayment('abc123');
        expect(result.state).toBe(state);
        expect(result.verified).toBe(true);
      }
    });

    it('should poll when contract not found initially', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ count: 0, results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state: 'ACTIVE',
            }],
          }),
        });

      const promise = ConduitCheckout.verifyPayment('abc123');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });

    it('should poll when state is pending', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state: 'OK', // Pending state
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state: 'ACTIVE',
            }],
          }),
        });

      const promise = ConduitCheckout.verifyPayment('abc123');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });

    it('should timeout after max polling time', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ count: 0, results: [] }),
      });

      const promise = ConduitCheckout.verifyPayment('abc123');

      // Advance past timeout
      await jest.advanceTimersByTimeAsync(11000);

      await expect(promise).rejects.toThrow('Payment verification timeout');
    });

    it('should fail on NEVER_FUNDED state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            state: 'NEVER_FUNDED',
          }],
        }),
      });

      await expect(ConduitCheckout.verifyPayment('abc123')).rejects.toThrow(
        'Payment verification failed: Contract was never funded'
      );
    });
  });

  describe('Security Checks', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        description: 'Test Product',
        tokenSymbol: 'USDC',
      };
    });

    it('should reject seller address mismatch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0xBADACTOR0000000000000000000000000000DEAD', // Wrong seller!
            amount: 50.0,
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      await expect(ConduitCheckout.verifyPayment('abc123')).rejects.toThrow(
        'Security violation: Seller address mismatch'
      );
    });

    it('should be case-insensitive for seller address check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0X1234567890ABCDEF1234567890ABCDEF12345678', // Uppercase
            amount: 50.0,
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      const result = await ConduitCheckout.verifyPayment('abc123');
      expect(result.verified).toBe(true);
    });

    it('should reject amount mismatch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 25.0, // Wrong amount!
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      await expect(ConduitCheckout.verifyPayment('abc123')).rejects.toThrow(
        'Security violation: Amount mismatch'
      );
    });

    it('should accept amount with small floating point difference', async () => {
      ConduitCheckout.currentPayment.amount = 50.0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0001, // Tiny difference (within 0.001 tolerance)
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      const result = await ConduitCheckout.verifyPayment('abc123');
      expect(result.verified).toBe(true);
    });

    it('should reject token mismatch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            currencySymbol: 'USDT', // Wrong token!
            state: 'ACTIVE',
          }],
        }),
      });

      await expect(ConduitCheckout.verifyPayment('abc123')).rejects.toThrow(
        'Security violation: Token mismatch'
      );
    });

    it('should not check amount/token if currentPayment not set', async () => {
      ConduitCheckout.currentPayment = null;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 999.0, // Different amount
            currencySymbol: 'USDT', // Different token
            state: 'ACTIVE',
          }],
        }),
      });

      const result = await ConduitCheckout.verifyPayment('abc123');
      expect(result.verified).toBe(true); // Should still pass (no currentPayment to compare)
    });
  });

  describe('API Error Handling', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
        verificationTimeout: 5000,
        verificationInterval: 1000,
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        tokenSymbol: 'USDC',
      };
    });

    it('should retry on API error', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state: 'ACTIVE',
            }],
          }),
        });

      const promise = ConduitCheckout.verifyPayment('abc123');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });

    it('should retry on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 1,
            results: [{
              contractid: 'abc123',
              sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
              amount: 50.0,
              currencySymbol: 'USDC',
              state: 'ACTIVE',
            }],
          }),
        });

      const promise = ConduitCheckout.verifyPayment('abc123');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.verified).toBe(true);
    });

    it('should NOT retry on security violation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0xBADACTOR0000000000000000000000000000DEAD',
            amount: 50.0,
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      await expect(ConduitCheckout.verifyPayment('abc123')).rejects.toThrow(
        'Security violation: Seller address mismatch'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1); // Should NOT retry
    });
  });

  describe('Callback Integration', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        tokenSymbol: 'USDC',
      };
    });

    it('should call onVerifying callback', async () => {
      const onVerifying = jest.fn();
      ConduitCheckout.config.onVerifying = onVerifying;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      await ConduitCheckout.verifyPayment('abc123');

      expect(onVerifying).toHaveBeenCalledWith({
        contractId: 'abc123',
        status: 'verifying',
      });
    });

    it('should handle onVerifying callback errors gracefully', async () => {
      const onVerifying = jest.fn(() => {
        throw new Error('Callback error');
      });
      ConduitCheckout.config.onVerifying = onVerifying;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            currencySymbol: 'USDC',
            state: 'ACTIVE',
          }],
        }),
      });

      // Should not throw even if callback throws
      const result = await ConduitCheckout.verifyPayment('abc123');
      expect(result.verified).toBe(true);
    });
  });

  describe('Open Payment', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });
    });

    it('should store currentPayment data', () => {
      // Mock window.open
      windowMock.open = jest.fn();

      ConduitCheckout.open({
        amount: '50.00',
        description: 'Test Product',
        orderId: 'ORDER-123',
        tokenSymbol: 'USDT',
      });

      expect(ConduitCheckout.currentPayment).toEqual({
        amount: 50.0,
        description: 'Test Product',
        tokenSymbol: 'USDT',
        orderId: 'ORDER-123',
      });
    });

    it('should use default tokenSymbol if not provided', () => {
      // Mock window.open
      windowMock.open = jest.fn();

      ConduitCheckout.open({
        amount: '50.00',
        description: 'Test Product',
      });

      expect(ConduitCheckout.currentPayment.tokenSymbol).toBe('USDC');
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        tokenSymbol: 'USDC',
      };
    });

    it('should clear currentPayment on cleanup', () => {
      ConduitCheckout.cleanup();
      expect(ConduitCheckout.currentPayment).toBeNull();
    });
  });

  describe('Verified Data Return', () => {
    beforeEach(() => {
      ConduitCheckout.init({
        sellerAddress: '0x1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://app.example.com',
      });

      ConduitCheckout.currentPayment = {
        amount: 50.0,
        tokenSymbol: 'USDC',
      };
    });

    it('should return all relevant data with verified flag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          results: [{
            contractid: 'abc123',
            chainAddress: '0xcontract456',
            sellerWalletId: '0x1234567890abcdef1234567890abcdef12345678',
            amount: 50.0,
            currencySymbol: 'USDC',
            description: 'Test Product',
            state: 'ACTIVE',
          }],
        }),
      });

      const result = await ConduitCheckout.verifyPayment('abc123');

      expect(result).toMatchObject({
        contractId: 'abc123',
        chainAddress: '0xcontract456',
        seller: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 50.0,
        currencySymbol: 'USDC',
        description: 'Test Product',
        state: 'ACTIVE',
        verified: true,
      });

      expect(result.verifiedAt).toBeDefined();
      expect(new Date(result.verifiedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Sleep Function', () => {
    it('should sleep for specified duration', async () => {
      const promise = ConduitCheckout.sleep(1000);
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
