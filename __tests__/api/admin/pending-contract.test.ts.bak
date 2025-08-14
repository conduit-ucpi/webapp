/**
 * Test for admin pending contract API endpoint
 */

import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/admin/pending-contract';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/admin/pending-contract', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Set up environment variables
    process.env.USER_SERVICE_URL = 'http://userService:8977';
    process.env.CONTRACT_SERVICE_URL = 'http://contractService:8979';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when no auth token is provided', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Authentication required' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return 401 when identity service fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Authentication failed' });
    });

    it('should return 403 when user is not admin', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ userType: 'user' })
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(403);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Admin access required' });
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Mock admin user
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ userType: 'admin' })
      });
    });

    it('should return 400 when contract address is missing', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Contract address is required' });
    });

    it('should return 400 when contract address format is invalid', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: 'invalid-address' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid contract address format' });
    });

    it('should accept valid contract address format', async () => {
      const mockPendingContracts = [
        {
          id: '123',
          chainAddress: '0x1234567890123456789012345678901234567890',
          amount: 1000,
          currency: 'USDC',
          description: 'Test contract',
          buyerEmail: 'buyer@example.com',
          sellerEmail: 'seller@example.com',
          expiryTimestamp: 1234567890
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPendingContracts)
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('HTTP Methods', () => {
    it('should return 405 for non-GET requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Contract Service Integration', () => {
    beforeEach(() => {
      // Mock admin user
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ userType: 'admin' })
      });
    });

    it('should fetch pending contracts from contract service', async () => {
      const mockPendingContracts = [
        {
          id: '123',
          chainAddress: '0x1234567890123456789012345678901234567890',
          amount: 1000,
          currency: 'USDC',
          description: 'Test contract',
          buyerEmail: 'buyer@example.com',
          sellerEmail: 'seller@example.com',
          expiryTimestamp: 1234567890
        },
        {
          id: '456',
          chainAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          amount: 2000,
          currency: 'USDC',
          description: 'Another contract',
          buyerEmail: 'buyer2@example.com',
          sellerEmail: 'seller2@example.com',
          expiryTimestamp: 1234567890
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPendingContracts)
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      // Verify contract service was called
      expect(global.fetch).toHaveBeenCalledWith(
        'http://contractService:8979/api/contracts',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Cookie': 'AUTH-TOKEN=test-token'
          }
        }
      );

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockPendingContracts[0]);
    });

    it('should return 404 when pending contract is not found', async () => {
      const mockPendingContracts = [
        {
          id: '456',
          chainAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          amount: 2000,
          currency: 'USDC',
          description: 'Another contract',
          buyerEmail: 'buyer2@example.com',
          sellerEmail: 'seller2@example.com',
          expiryTimestamp: 1234567890
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPendingContracts)
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({ 
        error: 'Pending contract not found for this address' 
      });
    });

    it('should handle contract service failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Internal server error' });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' },
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Internal server error' });
    });
  });

  describe('Case Insensitive Address Matching', () => {
    it('should match contract addresses case-insensitively', async () => {
      // Mock admin user
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ userType: 'admin' })
      });
      const mockPendingContracts = [
        {
          id: '123',
          chainAddress: '0x1234567890123456789012345678901234567890', // lowercase in db
          amount: 1000,
          currency: 'USDC',
          description: 'Test contract',
          buyerEmail: 'buyer@example.com',
          sellerEmail: 'seller@example.com',
          expiryTimestamp: 1234567890
        },
        {
          id: '456',
          chainAddress: '0x9876543210987654321098765432109876543210', // different address
          amount: 2000,
          currency: 'USDC',
          description: 'Different contract',
          buyerEmail: 'buyer2@example.com',
          sellerEmail: 'seller2@example.com',
          expiryTimestamp: 1234567890
        }
      ];

      // Mock contract service response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPendingContracts)
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { contractAddress: '0x1234567890123456789012345678901234567890' }, // mixed case query - search for the first contract
        headers: {
          cookie: 'AUTH-TOKEN=test-token'
        }
      });

      await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockPendingContracts[0]);
    });
  });
});