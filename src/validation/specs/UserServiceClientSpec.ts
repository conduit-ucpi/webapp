import { ExpectedEndpoint } from '../types';

/**
 * Defines the expected API endpoints for the User Service that the webapp depends on.
 * Based on the actual API routes used in the webapp.
 */
export class UserServiceClientSpec {
  static getExpectedEndpoints(): ExpectedEndpoint[] {
    return [
      // Login endpoint - used for Web3Auth authentication
      {
        path: '/api/auth/login',
        method: 'POST',
        description: 'Web3Auth login with idToken and wallet address',
        requestBodySchema: {
          type: 'object',
          properties: {
            idToken: { type: 'string' },
            walletAddress: { type: 'string' }
          },
          required: ['idToken', 'walletAddress']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            userId: { type: 'string' },
            email: { type: 'string' },
            walletAddress: { type: 'string' },
            userType: { type: 'string' }
          },
          required: ['success']
        },
        requiresAuthentication: false,
        tags: ['authentication', 'critical']
      },
      
      // Logout endpoint
      {
        path: '/api/auth/logout',
        method: 'POST',
        description: 'Clear user session and auth cookies',
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['authentication']
      },
      
      // User identity endpoint - used for getting current user
      {
        path: '/api/user/identity',
        method: 'GET',
        description: 'Get current user identity from session',
        responseSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            email: { type: 'string' },
            walletAddress: { type: 'string' },
            userType: { type: 'string' }
          },
          required: ['userId', 'email', 'walletAddress', 'userType']
        },
        requiresAuthentication: true,
        tags: ['authentication', 'critical']
      }
    ];
  }

  /**
   * Gets endpoints that are critical for webapp operation.
   * If these fail, the webapp cannot function properly.
   */
  static getCriticalEndpoints(): ExpectedEndpoint[] {
    return this.getExpectedEndpoints().filter(endpoint => 
      endpoint.tags?.includes('critical')
    );
  }
}