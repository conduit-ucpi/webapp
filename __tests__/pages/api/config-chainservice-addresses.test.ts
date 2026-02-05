/**
 * Test: /api/config fetches contract addresses from chainservice
 *
 * Verifies that the config endpoint calls chainservice to get contract addresses
 * instead of relying on environment variables.
 */

import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/config';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/config - chainservice contract addresses integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env = {
      ...originalEnv,
      RPC_URL: 'https://mainnet.base.org',
      CHAIN_ID: '8453',
      USDC_CONTRACT_ADDRESS: '0xUSDC123',
      CHAIN_SERVICE_URL: 'https://chainservice.example.com',
      DEFAULT_TOKEN_SYMBOL: 'USDC'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fetch contract addresses from chainservice and use them in config', async () => {
    const { req, res } = createMocks({
      method: 'GET'
    });

    // Mock chainservice response
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/chain/addresses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            factoryAddress: '0xFactory456FromChainservice',
            implementationAddress: '0xImpl789FromChainservice',
            timestamp: 1234567890
          })
        });
      }
      // Mock token details fetch (ethers JsonRpcProvider)
      if (url.includes('mainnet.base.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0x' // Mock RPC response
          })
        });
      }
      return Promise.reject(new Error('Unexpected fetch URL'));
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    // Verify chainservice was called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('chainservice.example.com/api/chain/addresses')
    );

    // Verify response includes addresses from chainservice
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.contractFactoryAddress).toBe('0xFactory456FromChainservice');
    expect(responseData.contractAddress).toBe('0xImpl789FromChainservice');
  });

  it('should fail if chainservice returns incomplete addresses', async () => {
    const { req, res } = createMocks({
      method: 'GET'
    });

    // Mock chainservice with incomplete response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        factoryAddress: '0xFactory456',
        // Missing implementationAddress
        timestamp: 1234567890
      })
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    // Should return 500 error
    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    expect(responseData.error).toBe('Failed to load configuration');
  });

  it('should fail if chainservice is unavailable', async () => {
    const { req, res } = createMocks({
      method: 'GET'
    });

    // Mock chainservice error
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    // Should return 500 error
    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    expect(responseData.error).toBe('Failed to load configuration');
  });

  it('should fail if chainservice returns non-200 status', async () => {
    const { req, res } = createMocks({
      method: 'GET'
    });

    // Mock chainservice with error status
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    // Should return 500 error
    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    expect(responseData.error).toBe('Failed to load configuration');
  });

  it('should fail if CHAIN_SERVICE_URL is not configured', async () => {
    const { req, res } = createMocks({
      method: 'GET'
    });

    // Remove CHAIN_SERVICE_URL from env
    delete process.env.CHAIN_SERVICE_URL;

    await handler(req as NextApiRequest, res as NextApiResponse);

    // Should return 500 error
    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    expect(responseData.error).toBe('Chain service URL not configured');
  });
});
