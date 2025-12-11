/**
 * Backend SIWX Messenger - Creates SIWE messages with backend nonces
 *
 * This messenger fetches nonces from our backend /api/auth/siwe/nonce
 * instead of generating random nonces like InformalMessenger does.
 */

import { InformalMessenger } from '@reown/appkit-siwx'
import type { SIWXMessage } from '@reown/appkit-controllers'
import { mLog } from '@/utils/mobileLogger'

/**
 * Get nonce from our backend
 *
 * HYBRID APPROACH: Support both headless SIWX (embedded wallets) and lazy auth (external wallets)
 * - Embedded wallets (social login): Have smart account + EOA, support headless signing
 * - External wallets (WalletConnect, MetaMask): Only EOA, require manual signature popup
 *
 * IMPORTANT: Embedded wallets use EOA for signatures (backend compatibility) but have
 * smart account capabilities that enable headless signing without user prompts.
 *
 * MOBILE FIX: Headless signing doesn't work reliably on mobile browsers (even for embedded wallets),
 * so we skip SIWX entirely on mobile and use lazy auth for all wallet types.
 */
async function getBackendNonce(input: SIWXMessage.Input): Promise<string> {
  mLog.info('BackendSIWXMessenger', '🔐 getNonce() called', {
    input,
    inputKeys: input ? Object.keys(input) : []
  })

  // MOBILE CHECK: Skip SIWX on mobile devices (headless signing doesn't work on mobile browsers)
  const isMobile = /mobile|android|iphone|ipod|ipad|tablet/i.test(navigator.userAgent)

  mLog.info('BackendSIWXMessenger', '📱 MOBILE DETECTION CHECK', {
    userAgent: navigator.userAgent,
    isMobile,
    willSkipSIWX: isMobile
  })

  if (isMobile) {
    mLog.info('BackendSIWXMessenger', '========================================')
    mLog.info('BackendSIWXMessenger', '📱📱📱 MOBILE DEVICE DETECTED 📱📱📱')
    mLog.info('BackendSIWXMessenger', 'SKIPPING SIWX on mobile - returning SKIP nonce')
    mLog.info('BackendSIWXMessenger', 'User will authenticate on first API call (lazy auth)')
    mLog.info('BackendSIWXMessenger', '========================================')
    return 'SKIP_SIWX_LAZY_AUTH'
  }

  mLog.info('BackendSIWXMessenger', '💻 Desktop detected - proceeding with wallet detection')

  // DETECTION STRATEGY: Check for embedded wallet indicators in global scope
  // Since SIWX input doesn't have wallet type info, we check AppKit's iframe/window state

  let isEmbeddedWallet = false
  let detectionMethod = 'unknown'

  try {
    // Method 1: Check for embedded wallet iframe (social/email login creates iframe)
    const embeddedIframe = document.querySelector('iframe[src*="secure.walletconnect"]')
    if (embeddedIframe) {
      isEmbeddedWallet = true
      detectionMethod = 'iframe detected'
      console.log('🔐 BackendSIWXMessenger: ✅ Embedded wallet detected via iframe')
    }

    // Method 2: Check for embedded wallet session in localStorage/sessionStorage
    if (!isEmbeddedWallet) {
      const storageKeys = Object.keys(localStorage)
      const hasEmbeddedSession = storageKeys.some(key =>
        key.includes('wc@2:client') ||
        key.includes('wc_embedded') ||
        key.includes('wc@2:core') ||
        key.includes('wc@2:universal_provider')
      )

      if (hasEmbeddedSession) {
        // Check if it's actually an embedded wallet session (not just WalletConnect session)
        const wcData = storageKeys
          .filter(k => k.includes('wc@2'))
          .map(k => {
            try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} }
          })

        // Embedded wallets have specific metadata indicating social/email login
        const hasEmbeddedMetadata = wcData.some((data: any) => {
          const metadata = data?.metadata || data?.peerMetadata
          return metadata?.name?.toLowerCase().includes('coinbase') || // Coinbase Wallet embedded
                 metadata?.name?.toLowerCase().includes('wallet') && metadata?.url?.includes('secure.walletconnect')
        })

        if (hasEmbeddedMetadata) {
          isEmbeddedWallet = true
          detectionMethod = 'storage metadata'
          console.log('🔐 BackendSIWXMessenger: ✅ Embedded wallet detected via storage metadata')
        }
      }
    }

  } catch (e) {
    console.log('🔐 BackendSIWXMessenger: Detection error:', e)
  }

  mLog.info('BackendSIWXMessenger', 'Detection result', {
    isEmbeddedWallet,
    detectionMethod,
    willProceedWithSIWX: isEmbeddedWallet,
    willSkipForLazyAuth: !isEmbeddedWallet
  })

  // HYBRID AUTH LOGIC:
  if (!isEmbeddedWallet) {
    // External wallet detected - skip SIWX, use lazy auth instead
    // NOTE: This code path should never be reached now that SIWX is disabled universally
    // But keeping it for backwards compatibility if SIWX is re-enabled in the future
    mLog.info('BackendSIWXMessenger', '🚫 External wallet detected - SKIPPING SIWX')
    mLog.info('BackendSIWXMessenger', 'Returning SKIP nonce for lazy auth')

    // Return special nonce that the verifier will recognize and skip
    // This allows the wallet connection to proceed without SIWX authentication
    // The user will authenticate later when they make their first API call (lazy auth)
    return 'SKIP_SIWX_LAZY_AUTH'
  }

  // Embedded wallet detected - proceed with SIWX headless signing
  mLog.info('BackendSIWXMessenger', '✅ Embedded wallet detected - proceeding with headless SIWX auth')
  mLog.info('BackendSIWXMessenger', 'Fetching nonce from backend')

  const response = await fetch('/api/auth/siwe/nonce')
  if (!response.ok) {
    throw new Error(`Failed to get nonce: ${response.status}`)
  }

  const { nonce } = await response.json()
  mLog.info('BackendSIWXMessenger', 'Received nonce from backend', { nonce })

  return nonce
}

/**
 * Backend SIWX Messenger extending InformalMessenger
 *
 * The only difference is that we fetch nonces from our backend
 * instead of generating random ones.
 */
export class BackendSIWXMessenger extends InformalMessenger {
  constructor() {
    // This messenger is only used client-side, so window must be available
    if (typeof window === 'undefined') {
      throw new Error('BackendSIWXMessenger can only be used in browser environment')
    }

    const domain = window.location.host
    const uri = window.location.origin

    super({
      domain,
      uri,
      getNonce: getBackendNonce, // Use our backend nonce fetcher
      clearChainIdNamespace: false // Keep full chain ID format
    })

    console.log('🔐 BackendSIWXMessenger: Initialized with backend nonce fetching', {
      domain,
      uri
    })
  }
}
