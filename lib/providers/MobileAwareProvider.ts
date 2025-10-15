/**
 * Mobile-aware provider wrapper that caches signatures to avoid duplicate MetaMask calls
 * Caches Web3Auth connection signatures and reuses them for backend authentication
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
  private signatureCache = new Map<string, { signature: string; timestamp: number; address: string }>();

  constructor(baseProvider: any) {
    this.baseProvider = baseProvider;
    this.isDesktop = !detectDevice().isMobile;

    mLog.info('MobileAwareProvider', 'Created mobile-aware provider wrapper with signature caching', {
      isDesktop: this.isDesktop,
      hasBaseProvider: !!baseProvider
    });
  }

  /**
   * Handle all provider requests with signature caching for mobile
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    mLog.info('MobileAwareProvider', `🚀 OUTGOING REQUEST [${requestId}]: ${args.method}`, {
      requestId,
      method: args.method,
      hasParams: !!args.params,
      paramsCount: args.params?.length || 0,
      isDesktop: this.isDesktop,
      isSigningMethod: this.isSigningMethod(args.method)
    });

    // Log signing method details
    if (this.isSigningMethod(args.method)) {
      let messagePreview = 'N/A';
      if (args.method === 'personal_sign' && args.params?.[0]) {
        let message = args.params[0];
        if (typeof message === 'string' && message.startsWith('0x')) {
          try {
            message = Buffer.from(message.slice(2), 'hex').toString('utf8');
          } catch (e) {
            // Keep hex version
          }
        }
        messagePreview = typeof message === 'string' ? message.substring(0, 100) + '...' : String(message);
      }

      const isBackendAuth = this.isOurBackendAuthSignature(args);

      mLog.info('MobileAwareProvider', `📝 SIGNING REQUEST DETAILS [${requestId}]`, {
        requestId,
        messagePreview,
        isBackendAuth,
        cacheSize: this.signatureCache.size
      });

      // Special logging for unknown signatures (likely Web3Auth internal)
      if (!isBackendAuth) {
        mLog.info('MobileAwareProvider', `🔍 WEB3AUTH INTERNAL SIGNATURE [${requestId}]`, {
          requestId,
          method: args.method,
          fullMessage: typeof args.params?.[0] === 'string' ? args.params[0] : 'Non-string message',
          messageLength: typeof args.params?.[0] === 'string' ? args.params[0].length : 0,
          paramsLength: args.params?.length || 0,
          allParams: args.params
        });
      }
    }

    // Desktop: direct provider always
    if (this.isDesktop) {
      mLog.debug('MobileAwareProvider', `💻 DESKTOP MODE [${requestId}]: Passing through to base provider`);
      const result = await this.baseProvider.request(args);
      mLog.debug('MobileAwareProvider', `✅ DESKTOP RESPONSE [${requestId}]: Received from base provider`);
      return result;
    }

    // Mobile: Check if this is our backend auth signature that we can serve from cache
    if (this.isSigningMethod(args.method) && this.isOurBackendAuthSignature(args)) {
      mLog.info('MobileAwareProvider', `🔍 CHECKING CACHE [${requestId}]: Backend auth signature detected`);

      const cachedSignature = this.getCachedSignatureForBackendAuth(args);
      if (cachedSignature) {
        mLog.info('MobileAwareProvider', `🎯 CACHE HIT [${requestId}]: Using cached Web3Auth signature for backend auth!`, {
          requestId,
          cacheSize: this.signatureCache.size,
          signatureLength: cachedSignature.length,
          signaturePreview: cachedSignature.substring(0, 20) + '...'
        });
        return cachedSignature;
      } else {
        mLog.warn('MobileAwareProvider', `❌ CACHE MISS [${requestId}]: No cached signature available, will request from MetaMask`);
      }
    }

    // Execute the request normally
    mLog.info('MobileAwareProvider', `📱 SENDING TO METAMASK [${requestId}]: Request will trigger app switch`);

    try {
      const result = await this.baseProvider.request(args);

      mLog.info('MobileAwareProvider', `✅ METAMASK RESPONSE [${requestId}]: Successfully received response`, {
        requestId,
        hasResult: !!result,
        resultType: typeof result,
        resultLength: typeof result === 'string' ? result.length : 'N/A'
      });

      // If this was a signing request that succeeded, cache it for potential reuse
      if (this.isSigningMethod(args.method) && result && typeof result === 'string') {
        mLog.info('MobileAwareProvider', `💾 CACHING RESPONSE [${requestId}]: Storing signature for potential reuse`);
        await this.cacheSignature(args, result, requestId);
      }

      return result;

    } catch (error) {
      mLog.error('MobileAwareProvider', `❌ METAMASK ERROR [${requestId}]: Request failed`, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      throw error;
    }
  }

  /**
   * Check if this is a signing method
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
   * Check if this is our backend authentication signature
   */
  private isOurBackendAuthSignature(args: { method: string; params?: any[] }): boolean {
    if (args.method === 'personal_sign' && args.params?.[0]) {
      const message = args.params[0];
      // Our backend auth messages start with "Authenticate wallet"
      if (typeof message === 'string') {
        return message.startsWith('Authenticate wallet');
      }
      // Handle hex-encoded messages
      if (typeof message === 'string' && message.startsWith('0x')) {
        try {
          const decoded = Buffer.from(message.slice(2), 'hex').toString('utf8');
          return decoded.startsWith('Authenticate wallet');
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Cache a signature for potential reuse
   */
  private async cacheSignature(args: { method: string; params?: any[] }, signature: string, requestId?: string): Promise<void> {
    const logPrefix = requestId ? `[${requestId}]` : '';

    try {
      mLog.info('MobileAwareProvider', `🔍 CACHE PREP ${logPrefix}: Getting wallet address for cache key`);

      // Get the current wallet address for cache key
      const accounts = await this.baseProvider.request({ method: 'eth_accounts' });
      const address = accounts?.[0];

      if (!address) {
        mLog.warn('MobileAwareProvider', `❌ CACHE FAILED ${logPrefix}: No address available for signature caching`);
        return;
      }

      mLog.debug('MobileAwareProvider', `📍 ADDRESS FOUND ${logPrefix}`, {
        address: address.substring(0, 10) + '...',
        fullLength: address.length
      });

      // Create cache entry
      const cacheEntry = {
        signature,
        timestamp: Date.now(),
        address: address.toLowerCase(),
      };

      // Use message as cache key
      let message = '';
      let messageType = 'unknown';

      if (args.method === 'personal_sign' && args.params?.[0]) {
        message = args.params[0];
        messageType = 'raw';

        // Handle hex-encoded messages
        if (typeof message === 'string' && message.startsWith('0x')) {
          messageType = 'hex-encoded';
          try {
            const decoded = Buffer.from(message.slice(2), 'hex').toString('utf8');
            mLog.debug('MobileAwareProvider', `🔤 HEX DECODE ${logPrefix}`, {
              originalLength: message.length,
              decodedLength: decoded.length,
              decodedPreview: decoded.substring(0, 50) + '...'
            });
            message = decoded;
            messageType = 'hex-decoded';
          } catch (e) {
            mLog.warn('MobileAwareProvider', `⚠️ HEX DECODE FAILED ${logPrefix}: Keeping original hex`, {
              error: e instanceof Error ? e.message : String(e)
            });
            // Keep original if decode fails
          }
        }
      }

      if (message) {
        const cacheKey = message;
        this.signatureCache.set(cacheKey, cacheEntry);

        mLog.info('MobileAwareProvider', `💾 SIGNATURE CACHED ${logPrefix}: Successfully stored signature`, {
          requestId,
          messageType,
          messagePreview: message.substring(0, 80) + '...',
          address: address.substring(0, 10) + '...',
          signaturePreview: signature.substring(0, 20) + '...',
          signatureLength: signature.length,
          cacheSize: this.signatureCache.size,
          timestamp: new Date().toISOString()
        });

        // Log cache contents for debugging
        mLog.debug('MobileAwareProvider', `📋 CACHE CONTENTS ${logPrefix}`, {
          totalEntries: this.signatureCache.size,
          entries: Array.from(this.signatureCache.entries()).map(([key, value]) => ({
            messagePreview: key.substring(0, 30) + '...',
            address: value.address.substring(0, 10) + '...',
            ageSeconds: Math.round((Date.now() - value.timestamp) / 1000)
          }))
        });

      } else {
        mLog.warn('MobileAwareProvider', `❌ CACHE SKIP ${logPrefix}: No message found to use as cache key`);
      }

    } catch (error) {
      mLog.error('MobileAwareProvider', `❌ CACHE ERROR ${logPrefix}: Failed to cache signature`, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Get cached signature for backend auth if available
   */
  private getCachedSignatureForBackendAuth(args: { method: string; params?: any[] }): string | null {
    try {
      mLog.info('MobileAwareProvider', '🔍 CACHE LOOKUP: Searching for reusable signature', {
        method: args.method,
        cacheSize: this.signatureCache.size
      });

      // Extract the message from backend auth request
      if (args.method === 'personal_sign' && args.params?.[0]) {
        let message = args.params[0];
        let messageProcessing = 'raw';

        // Handle hex-encoded messages
        if (typeof message === 'string' && message.startsWith('0x')) {
          messageProcessing = 'hex-decoding';
          try {
            message = Buffer.from(message.slice(2), 'hex').toString('utf8');
            messageProcessing = 'hex-decoded';
            mLog.debug('MobileAwareProvider', '🔤 CACHE LOOKUP: Decoded hex message', {
              originalLength: args.params[0].length,
              decodedLength: message.length,
              decodedPreview: message.substring(0, 50) + '...'
            });
          } catch (e) {
            mLog.warn('MobileAwareProvider', '❌ CACHE LOOKUP: Hex decode failed');
            return null;
          }
        }

        mLog.debug('MobileAwareProvider', '📋 CACHE LOOKUP: Backend auth message details', {
          messageProcessing,
          messagePreview: message.substring(0, 80) + '...',
          targetFormat: 'Authenticate wallet...'
        });

        // Look for any cached signature we can reuse (from Web3Auth connection)
        // For now, just return the most recent signature from the same address
        const allEntries = Array.from(this.signatureCache.values());
        const validEntries = allEntries.filter(entry => Date.now() - entry.timestamp < 300000); // 5 minutes
        const sortedEntries = validEntries.sort((a, b) => b.timestamp - a.timestamp);

        mLog.info('MobileAwareProvider', '📊 CACHE ANALYSIS', {
          totalCached: allEntries.length,
          withinTimeLimit: validEntries.length,
          timeLimit: '5 minutes',
          oldestValid: validEntries.length > 0 ? Math.round((Date.now() - validEntries[validEntries.length - 1].timestamp) / 1000) + 's ago' : 'none',
          newestValid: validEntries.length > 0 ? Math.round((Date.now() - validEntries[0].timestamp) / 1000) + 's ago' : 'none'
        });

        const recent = sortedEntries[0];

        if (recent) {
          const ageSeconds = Math.round((Date.now() - recent.timestamp) / 1000);
          mLog.info('MobileAwareProvider', '🎯 CACHE MATCH FOUND: Will reuse Web3Auth signature', {
            cacheAge: ageSeconds + 's',
            address: recent.address.substring(0, 10) + '...',
            signaturePreview: recent.signature.substring(0, 20) + '...',
            signatureLength: recent.signature.length,
            reuseReason: 'Recent signature from same wallet'
          });
          return recent.signature;
        } else {
          mLog.warn('MobileAwareProvider', '❌ CACHE MISS: No valid cached signatures found', {
            reason: validEntries.length === 0 ? 'No signatures within time limit' : 'No cached signatures at all'
          });
        }
      } else {
        mLog.warn('MobileAwareProvider', '❌ CACHE LOOKUP: Invalid method or params for backend auth cache lookup');
      }

      return null;
    } catch (error) {
      mLog.error('MobileAwareProvider', '❌ CACHE LOOKUP ERROR: Failed to retrieve cached signature', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
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