/**
 * Mobile-aware provider wrapper that handles app switches transparently
 * Makes ethers "just work" by fixing the provider layer below it
 */

import { detectDevice } from '@/utils/deviceDetection';
import { mLog } from '@/utils/mobileLogger';

export class MobileAwareProvider {
  private baseProvider: any;
  private isDesktop: boolean;

  constructor(baseProvider: any) {
    this.baseProvider = baseProvider;
    this.isDesktop = !detectDevice().isMobile;

    mLog.info('MobileAwareProvider', 'Created mobile-aware provider wrapper', {
      isDesktop: this.isDesktop,
      hasBaseProvider: !!baseProvider
    });
  }

  /**
   * Handle all provider requests with mobile app switch awareness
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    mLog.debug('MobileAwareProvider', `Provider request: ${args.method}`, {
      method: args.method,
      hasParams: !!args.params,
      isDesktop: this.isDesktop
    });

    // Desktop or non-signing methods: use direct provider
    if (this.isDesktop || !this.isSigningMethod(args.method)) {
      mLog.debug('MobileAwareProvider', 'Using direct provider request');
      return await this.baseProvider.request(args);
    }

    // Mobile signing method: use app switch aware implementation
    mLog.info('MobileAwareProvider', `Mobile signing request: ${args.method} - using app switch aware method`);
    return await this.mobileAwareRequest(args);
  }

  /**
   * Check if this is a signing method that requires mobile app switch handling
   */
  private isSigningMethod(method: string): boolean {
    const signingMethods = [
      'personal_sign',
      'eth_sign',
      'eth_signTypedData',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4',
      'eth_sendTransaction'
    ];
    return signingMethods.includes(method);
  }

  /**
   * Mobile-aware request handling that survives app switches
   */
  private async mobileAwareRequest(args: { method: string; params?: any[] }): Promise<any> {
    const requestId = `mobile_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    mLog.info('MobileAwareProvider', `=== STARTING MOBILE REQUEST ${requestId} ===`);
    mLog.info('MobileAwareProvider', 'Request details', {
      requestId,
      method: args.method,
      paramsCount: args.params?.length || 0,
      timestamp: new Date().toISOString()
    });

    try {
      // Store request state before app switch
      const requestData = {
        id: requestId,
        method: args.method,
        params: args.params,
        timestamp: Date.now(),
        status: 'pending'
      };

      mLog.info('MobileAwareProvider', 'Storing request state to localStorage');
      localStorage.setItem('mobile_provider_request', JSON.stringify(requestData));

      // Verify storage worked
      const stored = localStorage.getItem('mobile_provider_request');
      mLog.debug('MobileAwareProvider', 'Storage verification', {
        stored: !!stored,
        requestId
      });

      // Start the request (will trigger app switch)
      mLog.info('MobileAwareProvider', '🚀 CALLING BASE PROVIDER - APP SWITCH INCOMING');
      const requestPromise = this.baseProvider.request(args);
      mLog.info('MobileAwareProvider', 'Base provider request initiated - promise created');

      // Use polling to detect completion after app switch
      mLog.info('MobileAwareProvider', 'Starting polling mechanism for mobile completion');
      return await this.pollForMobileRequestCompletion(requestId, requestPromise);

    } catch (error) {
      // Clean up on error
      localStorage.removeItem('mobile_provider_request');
      mLog.error('MobileAwareProvider', 'Mobile request failed completely', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Poll for mobile request completion using Promise.race
   */
  private async pollForMobileRequestCompletion(requestId: string, requestPromise: Promise<any>): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes total
    const pollInterval = 2000; // Check every 2 seconds

    mLog.info('MobileAwareProvider', `🔄 STARTING POLLING for ${requestId}`);
    mLog.info('MobileAwareProvider', 'Polling configuration', {
      maxAttempts,
      pollInterval,
      totalTimeoutMs: maxAttempts * pollInterval
    });

    while (attempts < maxAttempts) {
      attempts++;

      mLog.debug('MobileAwareProvider', `📊 POLL ATTEMPT ${attempts}/${maxAttempts}`, {
        requestId,
        timeElapsed: attempts * pollInterval,
        timestamp: new Date().toISOString()
      });

      try {
        // Check if we're back from app switch by testing localStorage
        const storedRequest = localStorage.getItem('mobile_provider_request');
        if (!storedRequest) {
          mLog.warn('MobileAwareProvider', '⚠️ Request was cancelled - localStorage cleared');
          throw new Error('Request was cancelled');
        }

        mLog.debug('MobileAwareProvider', 'Request still active, testing promise resolution');

        // Race between the request promise and a timeout
        const result = await Promise.race([
          requestPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Poll timeout')), pollInterval)
          )
        ]);

        // SUCCESS - request completed!
        mLog.info('MobileAwareProvider', '🎉 MOBILE REQUEST COMPLETED SUCCESSFULLY!', {
          requestId,
          attempts,
          timeElapsed: attempts * pollInterval,
          resultType: typeof result,
          hasResult: !!result
        });

        localStorage.removeItem('mobile_provider_request');
        return result;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage === 'Poll timeout') {
          // Expected timeout - continue polling
          mLog.debug('MobileAwareProvider', `⏰ Poll timeout (expected) - continuing...`);

          // Brief pause before next attempt
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;

        } else {
          // Real error from the actual signing request
          mLog.error('MobileAwareProvider', '❌ REAL ERROR from signing request', {
            requestId,
            error: errorMessage,
            attempts,
            timeElapsed: attempts * pollInterval
          });
          localStorage.removeItem('mobile_provider_request');
          throw error;
        }
      }
    }

    // Timeout reached
    mLog.error('MobileAwareProvider', '⏰ POLLING TIMEOUT REACHED', {
      requestId,
      totalAttempts: attempts,
      totalTimeMs: maxAttempts * pollInterval
    });
    localStorage.removeItem('mobile_provider_request');
    throw new Error(`Mobile request timed out after ${maxAttempts * pollInterval / 1000} seconds`);
  }

  /**
   * Proxy all other provider methods
   */
  on(event: string, listener: (...args: any[]) => void): void {
    return this.baseProvider.on(event, listener);
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    return this.baseProvider.removeListener(event, listener);
  }

  // Proxy any other properties/methods that might be accessed
  get isMetaMask() {
    return this.baseProvider.isMetaMask;
  }

  get chainId() {
    return this.baseProvider.chainId;
  }

  get selectedAddress() {
    return this.baseProvider.selectedAddress;
  }
}