/**
 * Mobile-aware provider wrapper that handles app switches transparently
 * Makes ethers "just work" by fixing the provider layer below it
 */

import { detectDevice } from '@/utils/deviceDetection';
import { mLog } from '@/utils/mobileLogger';

// Add window.ethereum typing for MetaMask
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      selectedAddress?: string;
      _metamask?: {
        getState: () => Promise<any>;
      };
    };
  }
}

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

      // Try approaches sequentially to avoid MetaMask conflicts
      mLog.info('MobileAwareProvider', '🚀 STARTING SEQUENTIAL MOBILE SIGNATURE RETRIEVAL');

      // Try approaches in order of most likely to succeed
      const approaches = [
        { name: 'Direct MetaMask', method: () => this.directMetaMaskApproach(args, requestId) },
        { name: 'Raw Provider Bypass', method: () => this.rawProviderBypass(args, requestId) },
        { name: 'Event-Based Detection', method: () => this.eventBasedApproach(args, requestId) },
        { name: 'Original Web3Auth', method: () => this.originalProviderApproach(args, requestId) }
      ];

      for (const approach of approaches) {
        try {
          mLog.info('MobileAwareProvider', `🔄 Trying ${approach.name} approach`);
          const result = await approach.method();
          mLog.info('MobileAwareProvider', `🎉 SUCCESS: ${approach.name} approach worked!`, {
            requestId,
            hasResult: !!result
          });
          return result;
        } catch (error) {
          mLog.warn('MobileAwareProvider', `❌ ${approach.name} approach failed`, {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue to next approach
        }
      }

      // If all approaches failed
      throw new Error('All mobile signature approaches failed');

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
   * Approach 1: Original Web3Auth provider method (we know this fails)
   */
  private async originalProviderApproach(args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    mLog.info('MobileAwareProvider', '📱 APPROACH 1: Trying original Web3Auth provider');

    const requestPromise = this.baseProvider.request(args);
    return await this.pollForMobileRequestCompletion(requestId, requestPromise);
  }

  /**
   * Approach 2: Direct MetaMask provider detection and monitoring
   */
  private async directMetaMaskApproach(args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    mLog.info('MobileAwareProvider', '🦊 APPROACH 2: Direct MetaMask provider detection');

    // Check if we can access MetaMask directly
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask) {
      mLog.info('MobileAwareProvider', 'Found direct MetaMask provider, attempting signature');

      try {
        // Store the signing state
        const signingState = {
          requestId,
          method: args.method,
          params: args.params,
          timestamp: Date.now(),
          approach: 'direct_metamask'
        };
        localStorage.setItem('mobile_signing_state', JSON.stringify(signingState));

        // Try direct MetaMask request
        const result = await window.ethereum.request(args);

        mLog.info('MobileAwareProvider', '🎉 APPROACH 2 SUCCESS: Direct MetaMask signature received', {
          requestId,
          hasResult: !!result,
          resultLength: typeof result === 'string' ? result.length : 0
        });

        localStorage.removeItem('mobile_signing_state');
        return result;

      } catch (error) {
        mLog.warn('MobileAwareProvider', 'APPROACH 2 failed - direct MetaMask error', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    } else {
      mLog.warn('MobileAwareProvider', 'APPROACH 2 not available - no direct MetaMask access');
      throw new Error('Direct MetaMask not available');
    }
  }

  /**
   * Approach 3: Event-based completion detection using visibility and focus events
   */
  private async eventBasedApproach(args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    mLog.info('MobileAwareProvider', '👀 APPROACH 3: Event-based completion detection');

    return new Promise((resolve, reject) => {
      let completed = false;
      const startTime = Date.now();
      const timeout = 120000; // 2 minutes

      // Listen for app becoming visible again (user returned from MetaMask)
      const handleVisibilityChange = () => {
        if (!document.hidden && !completed) {
          mLog.info('MobileAwareProvider', '🔍 APPROACH 3: App became visible, checking for signature completion');

          // Give a brief moment for any async operations to complete
          setTimeout(() => {
            this.checkForCompletedSignature(requestId)
              .then((result) => {
                if (result) {
                  completed = true;
                  cleanup();
                  mLog.info('MobileAwareProvider', '🎉 APPROACH 3 SUCCESS: Found completed signature', {
                    requestId,
                    hasResult: !!result
                  });
                  resolve(result);
                }
              })
              .catch((error) => {
                mLog.debug('MobileAwareProvider', 'APPROACH 3: No signature found yet', { error: error.message });
              });
          }, 1000);
        }
      };

      // Listen for window focus (another indicator of return from app)
      const handleFocus = () => {
        if (!completed) {
          mLog.info('MobileAwareProvider', '🔍 APPROACH 3: Window focused, checking for signature completion');
          setTimeout(() => {
            this.checkForCompletedSignature(requestId)
              .then((result) => {
                if (result) {
                  completed = true;
                  cleanup();
                  resolve(result);
                }
              })
              .catch(() => {
                // Continue waiting
              });
          }, 500);
        }
      };

      const cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };

      // Set up event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);

      // Timeout fallback
      setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          mLog.warn('MobileAwareProvider', 'APPROACH 3 timeout - no signature detected via events');
          reject(new Error('Event-based approach timeout'));
        }
      }, timeout);

      // Trigger the actual signing request (which will cause app switch)
      mLog.info('MobileAwareProvider', 'APPROACH 3: Triggering signature request');
      this.baseProvider.request(args)
        .then((result: any) => {
          if (!completed) {
            completed = true;
            cleanup();
            mLog.info('MobileAwareProvider', '🎉 APPROACH 3 SUCCESS: Provider resolved normally', { requestId });
            resolve(result);
          }
        })
        .catch((error: any) => {
          mLog.warn('MobileAwareProvider', 'APPROACH 3: Provider request failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Don't reject immediately - events might still work
        });
    });
  }

  /**
   * Approach 4: Raw provider bypass - work below Web3Auth abstraction level
   */
  private async rawProviderBypass(args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    mLog.info('MobileAwareProvider', '⚡ APPROACH 4: Raw provider bypass - working below Web3Auth level');

    // Try to access the raw underlying provider that Web3Auth wraps
    const rawProvider = this.extractRawProvider();
    if (!rawProvider) {
      throw new Error('No raw provider found');
    }

    mLog.info('MobileAwareProvider', 'Found raw provider, attempting direct signature bypass');

    return new Promise((resolve, reject) => {
      let completed = false;
      const timeout = 120000; // 2 minutes

      // Set up deep link return detection
      const handleAppReturn = () => {
        if (!completed) {
          mLog.info('MobileAwareProvider', '🔍 APPROACH 4: App returned, checking raw provider state');

          // Check if the signature operation completed at the raw provider level
          setTimeout(async () => {
            try {
              // Try to detect if MetaMask completed the signature
              const signature = await this.extractCompletedSignature(rawProvider, args, requestId);
              if (signature && !completed) {
                completed = true;
                mLog.info('MobileAwareProvider', '🎉 APPROACH 4 SUCCESS: Raw signature extracted!', {
                  requestId,
                  signatureLength: signature.length
                });
                cleanup();
                resolve(signature);
              }
            } catch (error) {
              mLog.debug('MobileAwareProvider', 'APPROACH 4: No signature available yet', {
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }, 1000);
        }
      };

      const cleanup = () => {
        document.removeEventListener('visibilitychange', handleAppReturn);
        window.removeEventListener('focus', handleAppReturn);
        if (typeof window !== 'undefined' && 'removeEventListener' in window) {
          window.removeEventListener('pageshow', handleAppReturn);
        }
      };

      // Listen for various return signals
      document.addEventListener('visibilitychange', handleAppReturn);
      window.addEventListener('focus', handleAppReturn);
      if (typeof window !== 'undefined' && 'addEventListener' in window) {
        window.addEventListener('pageshow', handleAppReturn);
      }

      // Timeout cleanup
      setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          mLog.warn('MobileAwareProvider', 'APPROACH 4 timeout - raw bypass failed');
          reject(new Error('Raw provider bypass timeout'));
        }
      }, timeout);

      // Trigger the signing via multiple raw methods
      mLog.info('MobileAwareProvider', 'APPROACH 4: Triggering raw provider signature');
      this.triggerRawProviderSignature(rawProvider, args, requestId)
        .then((result: any) => {
          if (!completed && result) {
            completed = true;
            cleanup();
            mLog.info('MobileAwareProvider', '🎉 APPROACH 4 SUCCESS: Raw provider resolved immediately!');
            resolve(result);
          }
        })
        .catch((error: any) => {
          mLog.warn('MobileAwareProvider', 'APPROACH 4: Raw provider trigger failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Don't reject - we're still listening for app return
        });
    });
  }

  /**
   * Extract the raw provider from Web3Auth's wrapped provider
   */
  private extractRawProvider(): any {
    try {
      // Web3Auth wraps the underlying provider - try to extract it
      let rawProvider = this.baseProvider;

      // Check for common Web3Auth provider wrapper patterns
      if (rawProvider.provider) {
        mLog.debug('MobileAwareProvider', 'Found .provider property, using that');
        rawProvider = rawProvider.provider;
      }

      if (rawProvider._provider) {
        mLog.debug('MobileAwareProvider', 'Found ._provider property, using that');
        rawProvider = rawProvider._provider;
      }

      // Check for MetaMask specifically
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask) {
        mLog.debug('MobileAwareProvider', 'Using window.ethereum directly as raw provider');
        return window.ethereum;
      }

      // Check if we have direct access to the real provider
      if (rawProvider && rawProvider.isMetaMask) {
        mLog.debug('MobileAwareProvider', 'Found MetaMask raw provider');
        return rawProvider;
      }

      mLog.debug('MobileAwareProvider', 'Using base provider as raw provider fallback');
      return rawProvider;

    } catch (error) {
      mLog.warn('MobileAwareProvider', 'Failed to extract raw provider', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Trigger signature using raw provider methods
   */
  private async triggerRawProviderSignature(rawProvider: any, args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    try {
      // Store the exact signature request details for later retrieval
      const signatureRequest = {
        requestId,
        method: args.method,
        params: args.params,
        timestamp: Date.now(),
        rawProvider: 'triggered'
      };
      localStorage.setItem('raw_signature_request', JSON.stringify(signatureRequest));

      mLog.info('MobileAwareProvider', 'Stored signature request details for raw retrieval');

      // Try the signature request on the raw provider
      return await rawProvider.request(args);

    } catch (error) {
      mLog.debug('MobileAwareProvider', 'Raw provider signature trigger error (expected on mobile)', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Try to extract a completed signature from various sources
   */
  private async extractCompletedSignature(rawProvider: any, args: { method: string; params?: any[] }, requestId: string): Promise<any> {
    // Method 1: Check if the provider has any cached results
    try {
      if (rawProvider.selectedAddress) {
        // If we have an active address, MetaMask is responsive
        mLog.debug('MobileAwareProvider', 'MetaMask responsive with address', {
          address: rawProvider.selectedAddress.substring(0, 10) + '...'
        });

        // Check for any cached signature results in MetaMask's state
        if (rawProvider._metamask && rawProvider._metamask.getState) {
          const state = await rawProvider._metamask.getState();
          mLog.debug('MobileAwareProvider', 'MetaMask state retrieved', {
            hasState: !!state,
            keys: Object.keys(state || {})
          });
        }
      }
    } catch (error) {
      mLog.debug('MobileAwareProvider', 'Could not check MetaMask state', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Method 2: Check localStorage for results we might have stored
    const storedResult = localStorage.getItem('raw_signature_result');
    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult);
        if (parsed.requestId === requestId) {
          localStorage.removeItem('raw_signature_result');
          mLog.info('MobileAwareProvider', 'Found stored signature result!');
          return parsed.signature;
        }
      } catch (e) {
        // Invalid format
      }
    }

    // Method 3: Try a simple eth_accounts call to see if MetaMask state changed
    try {
      const accounts = await rawProvider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        mLog.debug('MobileAwareProvider', 'Raw provider responsive with accounts', {
          accountCount: accounts.length
        });
        // Provider is responsive, but we still need the actual signature
        // This is a heuristic indicating the user returned from MetaMask
      }
    } catch (error) {
      // Provider not ready yet
    }

    throw new Error('No completed signature found in raw provider');
  }

  /**
   * Check various sources for a completed signature
   */
  private async checkForCompletedSignature(requestId: string): Promise<any> {
    // Check localStorage for any signature results
    const signatureResult = localStorage.getItem('metamask_signature_result');
    if (signatureResult) {
      try {
        const parsed = JSON.parse(signatureResult);
        if (parsed.requestId === requestId) {
          localStorage.removeItem('metamask_signature_result');
          return parsed.signature;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Check if MetaMask state changed indicating completion
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // Get current account to verify MetaMask is responsive
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        mLog.debug('MobileAwareProvider', 'MetaMask responsive check', {
          accountCount: accounts?.length || 0,
          firstAccount: accounts?.[0]?.substring(0, 10) + '...'
        });

        // If MetaMask is responsive, it might mean the user completed an action
        // This is a heuristic - we can't know for sure without the actual signature

      } catch (error) {
        mLog.debug('MobileAwareProvider', 'MetaMask not responsive yet', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    throw new Error('No completed signature found');
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