/**
 * Test to ensure API routes correctly proxy to backend services
 */

import { createMocks } from 'node-mocks-http';
import handler from '../pages/api/auth/identity';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/auth/identity', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Set up environment variables
    process.env.USER_SERVICE_URL = 'http://userService:8977';
  });

  test('should proxy to correct backend endpoint', async () => {
    const mockResponse = { 
      ok: true, 
      status: 200,
      json: jest.fn().mockResolvedValue({ id: '123', userType: 'user' })
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'AUTH-TOKEN=test-token'
      }
    });

    await handler(req as any, res as any);

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith(
      'http://userService:8977/api/user/identity',
      {
        headers: {
          'Cookie': 'AUTH-TOKEN=test-token',
          'Authorization': 'Bearer test-token'
        }
      }
    );

    expect(res._getStatusCode()).toBe(200);
  });

  test('should forward cookies correctly', async () => {
    const testCookie = 'AUTH-TOKEN=abc123; session=xyz789';
    const mockResponse = { 
      ok: true, 
      status: 200,
      json: jest.fn().mockResolvedValue({ id: '123' })
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: testCookie
      }
    });

    await handler(req as any, res as any);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Cookie': testCookie,
          'Authorization': 'Bearer abc123'
        }
      })
    );
  });

  test('should handle missing cookies', async () => {
    const mockResponse = { 
      ok: true, 
      status: 200,
      json: jest.fn().mockResolvedValue({ id: '123' })
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { req, res } = createMocks({
      method: 'GET'
    });

    await handler(req as any, res as any);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          'Cookie': ''
        }
      })
    );
  });

  test('should only accept GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST'
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('should handle backend service errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

    const { req, res } = createMocks({
      method: 'GET'
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Internal server error' });
  });
});