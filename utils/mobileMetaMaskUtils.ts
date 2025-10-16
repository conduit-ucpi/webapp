/**
 * Utility functions for resolving MetaMask mobile cache issues
 * These can be called manually by users experiencing stale signature problems
 */

import { mLog } from './mobileLogger';
import { detectDevice } from './deviceDetection';

/**
 * Nuclear option: Clear ALL possible MetaMask and wallet-related cache
 * This should resolve persistent stale signature issues on mobile
 */
export async function clearAllWalletCache(): Promise<void> {
  const deviceInfo = detectDevice();

  if (!deviceInfo.isMobile) {
    console.log('Desktop detected - cache clearing not necessary');
    return;
  }

  mLog.info('MobileMetaMaskUtils', '🧨 NUCLEAR CACHE CLEAR: Starting comprehensive wallet cache clearing');

  try {
    // Clear ALL storage that could affect wallet state
    if (typeof window !== 'undefined') {

      // Step 1: Clear ALL localStorage and sessionStorage
      const allLocalKeys = [];
      const allSessionKeys = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) allLocalKeys.push(key);
      }

      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) allSessionKeys.push(key);
      }

      // Clear wallet-related keys
      const walletPatterns = [
        'metamask', 'wallet', 'ethereum', 'web3', 'provider',
        'signature', 'pending', 'request', 'auth', 'connect',
        'Web3Auth', 'openlogin', 'adapter'
      ];

      allLocalKeys.forEach(key => {
        const lowerKey = key.toLowerCase();
        if (walletPatterns.some(pattern => lowerKey.includes(pattern))) {
          window.localStorage.removeItem(key);
          mLog.debug('MobileMetaMaskUtils', 'Cleared localStorage key', { key });
        }
      });

      allSessionKeys.forEach(key => {
        const lowerKey = key.toLowerCase();
        if (walletPatterns.some(pattern => lowerKey.includes(pattern))) {
          window.sessionStorage.removeItem(key);
          mLog.debug('MobileMetaMaskUtils', 'Cleared sessionStorage key', { key });
        }
      });

      // Step 2: Nuclear clear of ALL provider state
      if (window.ethereum) {
        try {
          // Clear any accessible internal state
          const ethereum = window.ethereum as any;

          if (ethereum._state) {
            Object.keys(ethereum._state).forEach(key => {
              try {
                delete ethereum._state[key];
              } catch (e) {
                // Ignore errors
              }
            });
          }

          if (ethereum._rpcEngine) {
            try {
              delete ethereum._rpcEngine;
            } catch (e) {
              // Ignore errors
            }
          }

          if (ethereum.providers) {
            ethereum.providers.forEach((provider: any) => {
              try {
                if (provider._state) {
                  Object.keys(provider._state).forEach(key => {
                    delete provider._state[key];
                  });
                }
              } catch (e) {
                // Ignore errors
              }
            });
          }

          mLog.debug('MobileMetaMaskUtils', 'Cleared all accessible provider internal state');

        } catch (error) {
          mLog.debug('MobileMetaMaskUtils', 'Provider state clearing failed (expected)', {
            error: error instanceof Error ? error.message : String(error)
          });
        }

        // Step 3: Aggressive provider flushing
        const flushMethods = [
          'eth_accounts',
          'eth_chainId',
          'net_version',
          'eth_blockNumber',
          'web3_clientVersion',
          'eth_getBalance',
          'eth_gasPrice'
        ];

        for (const method of flushMethods) {
          try {
            await window.ethereum.request({ method, params: method === 'eth_getBalance' ? ['0x0000000000000000000000000000000000000000', 'latest'] : [] });
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            // Expected to fail, just clearing cache
          }
        }

        // Step 4: Permission resets
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
          });
        } catch (e) {
          // Expected to fail
        }

        try {
          await window.ethereum.request({
            method: 'wallet_getPermissions'
          });
        } catch (e) {
          // Expected to fail
        }
      }

      // Step 5: Clear any iframe-related state
      try {
        if (window.parent !== window) {
          // We're in an iframe, try to signal parent to clear cache too
          window.parent.postMessage({ type: 'CLEAR_WALLET_CACHE' }, '*');
        }
      } catch (e) {
        // Ignore cross-origin errors
      }

      // Step 6: Force garbage collection if available
      if ((window as any).gc) {
        try {
          (window as any).gc();
          mLog.debug('MobileMetaMaskUtils', 'Forced garbage collection');
        } catch (e) {
          // Not available in most browsers
        }
      }

      mLog.info('MobileMetaMaskUtils', '✅ NUCLEAR CACHE CLEAR: Completed comprehensive wallet cache clearing');

      // Recommend user to restart MetaMask app
      console.log('🔄 RECOMMENDATION: Please close and restart your MetaMask app to complete the cache clearing process');

    }
  } catch (error) {
    mLog.error('MobileMetaMaskUtils', '❌ NUCLEAR CACHE CLEAR: Failed to clear wallet cache', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Quick cache flush for signature requests
 * Less aggressive than nuclear option, good for retry scenarios
 */
export async function quickFlushSignatureCache(): Promise<void> {
  const deviceInfo = detectDevice();

  if (!deviceInfo.isMobile || typeof window === 'undefined' || !window.ethereum) {
    return;
  }

  mLog.info('MobileMetaMaskUtils', '⚡ QUICK FLUSH: Starting rapid signature cache flush');

  try {
    // Rapid-fire requests to flush pending signature state
    const flushRequests = [
      window.ethereum.request({ method: 'eth_accounts' }),
      window.ethereum.request({ method: 'eth_chainId' }),
      window.ethereum.request({ method: 'net_version' })
    ];

    // Don't wait for all to complete, just fire them off
    Promise.allSettled(flushRequests).catch(() => {
      // Ignore errors
    });

    // Clear specific signature-related storage
    const signatureKeys = [
      'metamask.pendingRequest',
      'metamask.signatureRequest',
      'metamask.lastRequest',
      'ethereum.pendingSignature'
    ];

    signatureKeys.forEach(key => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    mLog.info('MobileMetaMaskUtils', '✅ QUICK FLUSH: Completed rapid signature cache flush');

  } catch (error) {
    mLog.warn('MobileMetaMaskUtils', '⚠️ QUICK FLUSH: Failed but continuing', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Check if we're likely experiencing cache issues
 * Returns true if conditions suggest stale cache problems
 */
export function detectLikelyCacheIssues(): boolean {
  if (typeof window === 'undefined') return false;

  const deviceInfo = detectDevice();
  if (!deviceInfo.isMobile) return false;

  // Check for signs of cache issues
  const cacheIndicators = [
    // Old timestamp in localStorage
    window.localStorage.getItem('metamask.lastRequest'),
    window.localStorage.getItem('metamask.pendingRequest'),

    // Multiple failed connection attempts
    window.localStorage.getItem('wallet.failedAttempts'),

    // Web3Auth cache that might interfere
    window.localStorage.getItem('Web3Auth-cachedAdapter')
  ];

  const hasCacheIndicators = cacheIndicators.some(indicator => indicator !== null);

  if (hasCacheIndicators) {
    mLog.info('MobileMetaMaskUtils', '🔍 CACHE ISSUES DETECTED: Found indicators of potential cache problems', {
      indicators: cacheIndicators.filter(i => i !== null).length
    });
  }

  return hasCacheIndicators;
}

/**
 * Display user-friendly instructions for resolving cache issues
 */
export function getCacheResolutionInstructions(): string[] {
  return [
    "1. Close the MetaMask mobile app completely",
    "2. Clear your browser cache and data",
    "3. Restart the MetaMask app",
    "4. Try connecting again",
    "5. If issues persist, try the 'Clear Wallet Cache' button below"
  ];
}