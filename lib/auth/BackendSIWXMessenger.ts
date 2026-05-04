/**
 * Backend SIWX Messenger - Creates SIWE messages with backend nonces
 *
 * This messenger fetches nonces from our backend /api/auth/siwe/nonce
 * instead of generating random nonces like InformalMessenger does.
 */

import { InformalMessenger } from '@reown/appkit-siwx'
import type { SIWXMessage } from '@reown/appkit-controllers'
import { mLog } from '@/utils/mobileLogger'
import { SIWE_STATEMENT } from './siwe-statement'

/**
 * Detect whether the currently connected wallet is an embedded wallet
 * (social/email login with smart-account capability) vs. an external wallet
 * (MetaMask, WalletConnect, etc.).
 *
 * Embedded wallets support headless SIWX signing — no popup. External wallets
 * require a manual signature popup, so we skip SIWX for them and use lazy auth.
 *
 * Pure function: takes only DOM/storage references so it can be unit-tested
 * by injecting mocks. In production, callers pass globals.
 */
export function detectEmbeddedWallet(
  storage: Pick<Storage, 'getItem' | 'length' | 'key'> = typeof localStorage !== 'undefined' ? localStorage : ({ getItem: () => null, length: 0, key: () => null } as any),
  doc: Pick<Document, 'querySelector'> | null = typeof document !== 'undefined' ? document : null
): { isEmbeddedWallet: boolean; method: string } {
  const storageKeys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k) storageKeys.push(k)
  }

  try {
    // Method 0: Reown AppKit embedded wallet (email/social login)
    // Reown's email/Google/social login leaves @appkit-wallet/* and @appkit/connected_social
    // keys in localStorage and creates a smart account capable of headless signing.
    const hasAppkitEmbedded =
      storage.getItem('@appkit/connected_social') !== null ||
      storage.getItem('@appkit-wallet/EMAIL') !== null ||
      storageKeys.some(k => k.startsWith('@appkit-wallet/SMART_ACCOUNT'))

    if (hasAppkitEmbedded) {
      return { isEmbeddedWallet: true, method: 'appkit social/email storage' }
    }

    // Method 1: Embedded wallet iframe (older WalletConnect embedded flow)
    if (doc) {
      const embeddedIframe = doc.querySelector('iframe[src*="secure.walletconnect"]')
      if (embeddedIframe) {
        return { isEmbeddedWallet: true, method: 'iframe detected' }
      }
    }

    // Method 2: Embedded wallet session metadata in WalletConnect storage
    const hasEmbeddedSession = storageKeys.some(key =>
      key.includes('wc@2:client') ||
      key.includes('wc_embedded') ||
      key.includes('wc@2:core') ||
      key.includes('wc@2:universal_provider')
    )

    if (hasEmbeddedSession) {
      const wcData = storageKeys
        .filter(k => k.includes('wc@2'))
        .map(k => {
          try { return JSON.parse(storage.getItem(k) || '{}') } catch { return {} }
        })

      const hasEmbeddedMetadata = wcData.some((data: any) => {
        const metadata = data?.metadata || data?.peerMetadata
        return metadata?.name?.toLowerCase().includes('coinbase') ||
               (metadata?.name?.toLowerCase().includes('wallet') && metadata?.url?.includes('secure.walletconnect'))
      })

      if (hasEmbeddedMetadata) {
        return { isEmbeddedWallet: true, method: 'storage metadata' }
      }
    }
  } catch (e) {
    console.log('🔐 BackendSIWXMessenger: Detection error:', e)
  }

  return { isEmbeddedWallet: false, method: 'unknown' }
}

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

  const detection = detectEmbeddedWallet()
  const isEmbeddedWallet = detection.isEmbeddedWallet
  const detectionMethod = detection.method

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
      statement: SIWE_STATEMENT,
      getNonce: getBackendNonce, // Use our backend nonce fetcher
      clearChainIdNamespace: false // Keep full chain ID format
    })

    console.log('🔐 BackendSIWXMessenger: Initialized with backend nonce fetching', {
      domain,
      uri
    })
  }
}
