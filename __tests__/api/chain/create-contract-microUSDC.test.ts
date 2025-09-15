import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/chain/create-contract';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('/api/chain/create-contract - microUSDC Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock environment variable
    process.env.CHAIN_SERVICE_URL = 'http://localhost:8978';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Amount forwarding to Chain Service', () => {
    it('should forward microUSDC amounts unchanged to chain service', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': 'AUTH-TOKEN=valid-token'
        },
        body: {
          contractserviceId: 'test-contract-123',
          tokenAddress: '0xUSDCContractAddress',
          buyer: '0xBuyerAddress',
          seller: '0xSellerAddress', 
          amount: '250000', // 0.25 USDC in microUSDC format
          expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
          description: 'Test contract'
        },
        query: {}
      });

      // Mock successful chain service response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xContractAddress'
        })
      });

      await handler(req as any, res);

      // Verify the call to chain service
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8978/api/chain/create-contract',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-token',
            'Cookie': 'AUTH-TOKEN=valid-token'
          },
          body: JSON.stringify({
            contractserviceId: 'test-contract-123',
            tokenAddress: '0xUSDCContractAddress',
            buyer: '0xBuyerAddress',
            seller: '0xSellerAddress',
            amount: '250000', // Should remain as microUSDC string
            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
            description: 'Test contract'
          })
        }
      );

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle large microUSDC amounts correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': 'AUTH-TOKEN=valid-token'
        },
        body: {
          tokenAddress: '0xUSDCContractAddress',
          buyer: '0xBuyerAddress',
          seller: '0xSellerAddress',
          amount: '1234567890', // 1234.567890 USDC in microUSDC
          expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
          description: 'Large amount test'
        },
        query: {}
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xContractAddress'
        })
      });

      await handler(req as any, res);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody.amount).toBe('1234567890');
      expect(res._getStatusCode()).toBe(200);
    });

    it('should preserve exact microUSDC precision for edge cases', async () => {
      const testCases = [
        { amount: '1', description: '0.000001 USDC (1 microUSDC)' },
        { amount: '999999', description: '0.999999 USDC' },
        { amount: '1000000', description: '1.000000 USDC exactly' },
        { amount: '123456', description: '0.123456 USDC with precision' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const { req, res } = createMocks({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cookie': 'AUTH-TOKEN=valid-token'
          },
          body: {
            tokenAddress: '0xUSDCContractAddress',
            buyer: '0xBuyerAddress',
            seller: '0xSellerAddress',
            amount: testCase.amount,
            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
            description: testCase.description
          },
          query: {}
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            success: true,
            contractAddress: '0xContractAddress'
          })
        });

        await handler(req as any, res);

        const callArgs = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        
        expect(requestBody.amount).toBe(testCase.amount);
        expect(res._getStatusCode()).toBe(200);
      }
    });
  });

  describe('Error handling', () => {
    it('should return 401 when AUTH-TOKEN is missing', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json'
          // No cookie header
        },
        body: {
          buyer: '0xBuyerAddress',
          seller: '0xSellerAddress',
          amount: '250000',
          expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
          description: 'Test contract'
        },
        query: {}
      });

      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Authentication required'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return 405 for non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'cookie': 'AUTH-TOKEN=valid-token'
        },
        query: {}
      });

      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should forward chain service errors correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': 'AUTH-TOKEN=valid-token'
        },
        body: {
          tokenAddress: '0xUSDCContractAddress',
          buyer: '0xBuyerAddress',
          seller: '0xSellerAddress',
          amount: '250000',
          expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
          description: 'Test contract'
        },
        query: {}
      });

      // Mock chain service error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'Invalid contract parameters'
        })
      });

      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid contract parameters'
      });
    });
  });

  describe('Request structure validation', () => {
    it('should forward complete request body with microUSDC amounts', async () => {
      const requestBody = {
        tokenAddress: '0xUSDCContractAddress',
        buyer: '0xBuyerAddress123',
        seller: '0xSellerAddress456',
        amount: '1500000', // 1.5 USDC in microUSDC - critical test case
        expiryTimestamp: 1234567890,
        description: 'Complete test contract with microUSDC amount'
      };

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': 'AUTH-TOKEN=test-token-123'
        },
        body: requestBody,
        query: {}
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xNewContractAddress'
        })
      });

      await handler(req as any, res);

      // Verify exact request forwarding - THE CRITICAL TEST
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8978/api/chain/create-contract',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123',
            'Cookie': 'AUTH-TOKEN=test-token-123'
          },
          body: JSON.stringify(requestBody) // Should contain microUSDC amount unchanged
        }
      );

      // Verify the amount is preserved exactly as microUSDC
      const callArgs = mockFetch.mock.calls[0];
      const sentRequestBody = JSON.parse(callArgs[1].body);
      expect(sentRequestBody.amount).toBe('1500000'); // Must be microUSDC, not converted to 1.5

      expect(res._getStatusCode()).toBe(200);
    });
  });
});