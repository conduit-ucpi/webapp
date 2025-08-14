import { ExpectedEndpoint } from '../types';

/**
 * Defines the expected API endpoints for the Contract Service that the webapp depends on.
 * Based on the actual API routes used in the webapp.
 */
export class ContractServiceClientSpec {
  static getExpectedEndpoints(): ExpectedEndpoint[] {
    return [
      // Get user contracts
      {
        path: '/api/contracts/user',
        method: 'GET',
        description: 'Get contracts for the authenticated user',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              buyerAddress: { type: 'string' },
              sellerAddress: { type: 'string' },
              amount: { type: 'string' },
              timeDelaySeconds: { type: 'number' },
              description: { type: 'string' },
              status: { type: 'string' },
              contractAddress: { type: 'string' },
              createdAt: { type: 'string' },
              expiryDate: { type: 'string' }
            },
            required: ['id', 'buyerAddress', 'sellerAddress', 'amount', 'status']
          }
        },
        requiresAuthentication: true,
        tags: ['contracts', 'critical']
      },
      
      // Create pending contract
      {
        path: '/api/contracts',
        method: 'POST',
        description: 'Create a new pending contract before blockchain deployment',
        requestBodySchema: {
          type: 'object',
          properties: {
            buyerAddress: { type: 'string' },
            sellerAddress: { type: 'string' },
            amount: { type: 'string' },
            timeDelaySeconds: { type: 'number' },
            description: { type: 'string' },
            buyerEmail: { type: 'string' },
            sellerEmail: { type: 'string' },
            productName: { type: 'string' }
          },
          required: ['buyerAddress', 'sellerAddress', 'amount', 'timeDelaySeconds']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            contractId: { type: 'string' },
            contract: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' }
              }
            }
          },
          required: ['success', 'contractId']
        },
        requiresAuthentication: true,
        tags: ['contracts', 'critical']
      },
      
      // Update contract with blockchain address
      {
        path: '/api/contracts/{contractId}/deployed',
        method: 'PUT',
        description: 'Update contract with deployed blockchain address',
        requestBodySchema: {
          type: 'object',
          properties: {
            contractAddress: { type: 'string' },
            transactionHash: { type: 'string' }
          },
          required: ['contractAddress', 'transactionHash']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['contracts', 'critical']
      },
      
      // Get contract by ID
      {
        path: '/api/contracts/{contractId}',
        method: 'GET',
        description: 'Get a specific contract by ID',
        responseSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            buyerAddress: { type: 'string' },
            sellerAddress: { type: 'string' },
            amount: { type: 'string' },
            timeDelaySeconds: { type: 'number' },
            description: { type: 'string' },
            status: { type: 'string' },
            contractAddress: { type: 'string' },
            createdAt: { type: 'string' },
            expiryDate: { type: 'string' }
          },
          required: ['id', 'buyerAddress', 'sellerAddress', 'amount', 'status']
        },
        requiresAuthentication: true,
        tags: ['contracts']
      },
      
      // Update contract status
      {
        path: '/api/contracts/{contractId}/status',
        method: 'PUT',
        description: 'Update contract status (disputed, resolved, etc.)',
        requestBodySchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['status']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['contracts']
      },
      
      // Submit dispute entry
      {
        path: '/api/contracts/{contractId}/dispute',
        method: 'PATCH',
        description: 'Submit a new dispute entry to the audit trail',
        requestBodySchema: {
          type: 'object',
          properties: {
            timestamp: { type: 'number' },
            userEmail: { type: 'string' },
            reason: { type: 'string', maxLength: 160 },
            refundPercent: { type: 'number', minimum: 0, maximum: 100 }
          },
          required: ['timestamp', 'userEmail', 'reason', 'refundPercent']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['contracts', 'disputes']
      }
    ];
  }

  /**
   * Gets endpoints that are critical for webapp operation.
   */
  static getCriticalEndpoints(): ExpectedEndpoint[] {
    return this.getExpectedEndpoints().filter(endpoint => 
      endpoint.tags?.includes('critical')
    );
  }
}