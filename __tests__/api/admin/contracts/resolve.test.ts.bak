import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/contracts/[id]/resolve';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('/api/admin/contracts/[id]/resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.CONTRACT_SERVICE_URL = 'http://localhost:8976';
    process.env.CHAIN_SERVICE_URL = 'http://localhost:8978';
  });

  it('resolves dispute successfully with chain address', async () => {
    // Mock chain service response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        transactionHash: '0xabc123'
      })
    } as Response);

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      headers: { cookie: 'AUTH-TOKEN=test-token' },
      body: {
        buyerPercentage: 60,
        sellerPercentage: 40,
        resolutionNote: 'Resolved in favor of buyer',
        chainAddress: '0x1234567890abcdef'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);

    // Should call chain service with provided chain address
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8978/api/admin/contracts/0x1234567890abcdef/resolve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'AUTH-TOKEN=test-token',
        },
        body: JSON.stringify({
          buyerPercentage: 60,
          sellerPercentage: 40,
          resolutionNote: 'Resolved in favor of buyer'
        }),
      }
    );
  });

  it('returns 400 when chain address is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      headers: { cookie: 'AUTH-TOKEN=test-token' },
      body: {
        buyerPercentage: 60,
        sellerPercentage: 40,
        resolutionNote: 'Test resolution'
        // chainAddress is missing
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Chain address is required'
    });
  });

  it('validates percentages must add up to 100', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      body: {
        buyerPercentage: 60,
        sellerPercentage: 50, // 60 + 50 = 110, not 100
        resolutionNote: 'Test resolution',
        chainAddress: '0x1234567890abcdef'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Buyer and seller percentages must add up to 100%'
    });
  });

  it('validates percentages are numbers', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      body: {
        buyerPercentage: '60', // String instead of number
        sellerPercentage: 40,
        resolutionNote: 'Test resolution',
        chainAddress: '0x1234567890abcdef'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Buyer and seller percentages must be numbers'
    });
  });

  it('validates percentages are within 0-100 range', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      body: {
        buyerPercentage: -10,
        sellerPercentage: 110,
        resolutionNote: 'Test resolution',
        chainAddress: '0x1234567890abcdef'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Percentages must be between 0 and 100'
    });
  });

  it('handles chain service errors', async () => {
    // Mock chain service error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error'
    } as Response);

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-123' },
      headers: { cookie: 'AUTH-TOKEN=test-token' },
      body: {
        buyerPercentage: 60,
        sellerPercentage: 40,
        resolutionNote: 'Test resolution',
        chainAddress: '0x1234567890abcdef'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to resolve dispute'
    });
  });

  it('only allows POST method', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'contract-123' }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed'
    });
  });

  it('requires contract ID', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: {}, // No ID provided
      body: {
        buyerPercentage: 60,
        sellerPercentage: 40,
        resolutionNote: 'Test resolution'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Contract ID is required'
    });
  });

  it('includes email addresses when provided in request body', async () => {
    // Mock chain service response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        transactionHash: '0xdef456'
      })
    } as Response);

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-789' },
      headers: { cookie: 'AUTH-TOKEN=test-token' },
      body: {
        buyerPercentage: 70,
        sellerPercentage: 30,
        resolutionNote: 'Resolved with email notification',
        chainAddress: '0xabcdef1234567890',
        buyerEmail: 'buyer@example.com',
        sellerEmail: 'seller@example.com'
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);

    // Verify chain service was called with email addresses
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8978/api/admin/contracts/0xabcdef1234567890/resolve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'AUTH-TOKEN=test-token',
        },
        body: JSON.stringify({
          buyerPercentage: 70,
          sellerPercentage: 30,
          resolutionNote: 'Resolved with email notification',
          buyerEmail: 'buyer@example.com',
          sellerEmail: 'seller@example.com'
        }),
      }
    );
  });

  it('handles missing email addresses gracefully', async () => {
    // Mock chain service response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        transactionHash: '0xghi789'
      })
    } as Response);

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'contract-101' },
      headers: { cookie: 'AUTH-TOKEN=test-token' },
      body: {
        buyerPercentage: 50,
        sellerPercentage: 50,
        resolutionNote: 'Resolved without emails',
        chainAddress: '0x9876543210fedcba'
        // Email addresses are not provided
      }
    });

    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(200);

    // Verify chain service was called with undefined email addresses
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8978/api/admin/contracts/0x9876543210fedcba/resolve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'AUTH-TOKEN=test-token',
        },
        body: JSON.stringify({
          buyerPercentage: 50,
          sellerPercentage: 50,
          resolutionNote: 'Resolved without emails',
          buyerEmail: undefined,
          sellerEmail: undefined
        }),
      }
    );
  });
});