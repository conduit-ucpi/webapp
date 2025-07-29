import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/contracts';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('/api/admin/contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USER_SERVICE_URL = 'http://localhost:8977';
    process.env.CONTRACT_SERVICE_URL = 'http://localhost:8979';
    process.env.CHAIN_SERVICE_URL = 'http://localhost:8978';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed'
    });
  });

  it('should return 401 when no auth token provided', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Authentication required'
    });
  });

  it('should return 401 when identity check fails', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=invalid-token'
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    } as Response);

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Authentication failed'
    });
  });

  it('should return 403 when user is not admin', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=valid-token'
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userType: 'user' })
    } as Response);

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Admin access required'
    });
  });

  it('should return enriched contracts for admin user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=admin-token'
      }
    });

    const contractServiceData = [
      {
        id: '1',
        sellerEmail: 'seller@example.com',
        buyerEmail: 'buyer@example.com',
        amount: 1000,
        currency: 'USDC',
        description: 'Test contract',
        expiryTimestamp: 1753749402,
        chainAddress: '0x123',
        createdAt: '2025-01-01T00:00:00Z'
      },
      {
        id: '2',
        sellerEmail: 'seller2@example.com',
        amount: 2000,
        currency: 'USDC',
        description: 'Pending contract',
        expiryTimestamp: 1753749402,
        createdAt: '2025-01-02T00:00:00Z'
      }
    ];

    const deployedContracts = [
      {
        id: '1',
        chainAddress: '0x123',
        buyerEmail: 'buyer@example.com',
        sellerEmail: 'seller@example.com'
      }
    ];

    const chainData = {
      status: 'ACTIVE',
      funded: true,
      buyerAddress: '0xbuyer',
      sellerAddress: '0xseller'
    };

    // Mock identity check (admin)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userType: 'admin' })
    } as Response);

    // Mock contract service call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractServiceData
    } as Response);

    // Mock deployed contracts call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => deployedContracts
    } as Response);

    // Mock chain service call for contract with chainAddress
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => chainData
    } as Response);

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);
    const result = JSON.parse(res._getData());
    
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: '1',
      status: 'ACTIVE',
      funded: true,
      buyerAddress: '0xbuyer',
      sellerAddress: '0xseller'
    });
    expect(result[1]).toMatchObject({
      id: '2',
      sellerEmail: 'seller2@example.com',
      amount: 2000
    });
  });

  it('should handle contract service error', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=admin-token'
      }
    });

    // Mock identity check (admin)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userType: 'admin' })
    } as Response);

    // Mock contract service failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error'
    });
  });

  it('should continue when deployed contracts fetch fails', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=admin-token'
      }
    });

    const contractServiceData = [
      {
        id: '1',
        sellerEmail: 'seller@example.com',
        amount: 1000,
        currency: 'USDC',
        description: 'Test contract',
        expiryTimestamp: 1753749402,
        createdAt: '2025-01-01T00:00:00Z'
      }
    ];

    // Mock identity check (admin)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userType: 'admin' })
    } as Response);

    // Mock contract service call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractServiceData
    } as Response);

    // Mock deployed contracts failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);
    const result = JSON.parse(res._getData());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '1',
      sellerEmail: 'seller@example.com',
      amount: 1000
    });
  });

  it('should continue when chain service call fails', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=admin-token'
      }
    });

    const contractServiceData = [
      {
        id: '1',
        chainAddress: '0x123',
        sellerEmail: 'seller@example.com',
        amount: 1000,
        currency: 'USDC',
        description: 'Test contract',
        expiryTimestamp: 1753749402,
        createdAt: '2025-01-01T00:00:00Z'
      }
    ];

    // Mock identity check (admin)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userType: 'admin' })
    } as Response);

    // Mock contract service call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractServiceData
    } as Response);

    // Mock deployed contracts call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response);

    // Mock chain service failure
    mockFetch.mockRejectedValueOnce(new Error('Chain service error'));

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);
    const result = JSON.parse(res._getData());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '1',
      chainAddress: '0x123',
      sellerEmail: 'seller@example.com'
    });
  });
});