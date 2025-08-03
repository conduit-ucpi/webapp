import { ExpectedEndpoint } from '../types';

/**
 * Defines the expected API endpoints for the Chain Service that the webapp depends on.
 * Based on the actual API routes used in the webapp.
 */
export class ChainServiceClientSpec {
  static getExpectedEndpoints(): ExpectedEndpoint[] {
    return [
      // Deploy contract endpoint
      {
        path: '/api/escrow/deploy',
        method: 'POST',
        description: 'Deploy a new escrow contract to the blockchain',
        requestBodySchema: {
          type: 'object',
          properties: {
            signedTransaction: { type: 'string' },
            contractData: {
              type: 'object',
              properties: {
                buyerAddress: { type: 'string' },
                sellerAddress: { type: 'string' },
                amount: { type: 'string' },
                timeDelaySeconds: { type: 'number' },
                description: { type: 'string' }
              },
              required: ['buyerAddress', 'sellerAddress', 'amount', 'timeDelaySeconds']
            }
          },
          required: ['signedTransaction', 'contractData']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            transactionHash: { type: 'string' },
            contractAddress: { type: 'string' },
            gasUsed: { type: 'string' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['contract', 'critical']
      },
      
      // Get contract status
      {
        path: '/api/escrow/status/{contractAddress}',
        method: 'GET',
        description: 'Get the current status of an escrow contract',
        responseSchema: {
          type: 'object',
          properties: {
            contractAddress: { type: 'string' },
            status: { type: 'string' },
            amount: { type: 'string' },
            timeDelaySeconds: { type: 'number' },
            expiryTimestamp: { type: 'number' },
            buyerAddress: { type: 'string' },
            sellerAddress: { type: 'string' }
          },
          required: ['contractAddress', 'status']
        },
        requiresAuthentication: true,
        tags: ['contract', 'critical']
      },
      
      // Submit transaction endpoint
      {
        path: '/api/escrow/submit-transaction',
        method: 'POST',
        description: 'Submit a signed transaction to the blockchain',
        requestBodySchema: {
          type: 'object',
          properties: {
            signedTransaction: { type: 'string' },
            transactionType: { type: 'string' }
          },
          required: ['signedTransaction', 'transactionType']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            transactionHash: { type: 'string' },
            gasUsed: { type: 'string' }
          },
          required: ['success']
        },
        requiresAuthentication: true,
        tags: ['transaction', 'critical']
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