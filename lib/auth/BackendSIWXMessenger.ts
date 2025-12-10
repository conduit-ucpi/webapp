/**
 * Backend SIWX Messenger - Creates SIWE messages with backend nonces
 *
 * This messenger fetches nonces from our backend /api/auth/siwe/nonce
 * instead of generating random nonces like InformalMessenger does.
 */

import { InformalMessenger } from '@reown/appkit-siwx'
import type { SIWXMessage } from '@reown/appkit-controllers'

/**
 * Get nonce from our backend
 *
 * HYBRID APPROACH: Support both headless SIWX (embedded wallets) and lazy auth (external wallets)
 * - Embedded wallets (social login): Headless signing works, so proceed with SIWX
 * - External wallets (WalletConnect, MetaMask): Headless signing NOT supported, throw to skip SIWX
 */
async function getBackendNonce(input: SIWXMessage.Input): Promise<string> {
  console.log('🔐 BackendSIWXMessenger: getNonce called', {
    inputKeys: input ? Object.keys(input) : [],
    accountType: (input as any).accountType,
    address: (input as any).address,
    chainNamespace: (input as any).chainNamespace
  })

  // Detect wallet type from accountType
  // - EOA (Externally Owned Account) = external wallets like MetaMask, Rainbow, etc.
  // - Smart accounts = embedded wallets created via social login (Google, Twitter, etc.)
  const accountType = (input as any).accountType

  // Check if this is an EOA (external wallet) - these don't support headless signing
  if (accountType === 'eoa') {
    console.log('🔐 BackendSIWXMessenger: EOA detected (external wallet) - skipping SIWX for lazy auth')
    console.log('🔐 BackendSIWXMessenger: User will be prompted to sign on first API call instead (better UX)')

    // Throw error to abort SIWX flow for external wallets
    // This is intentional - lazy auth will handle authentication on first API call
    throw new Error('SIWX_SKIP_EOA: External wallet detected - using lazy auth instead')
  }

  // If we get here, it's an embedded wallet (smart account) - proceed with SIWX
  console.log('🔐 BackendSIWXMessenger: Embedded wallet detected - proceeding with headless SIWX auth')
  console.log('🔐 BackendSIWXMessenger: Fetching nonce from backend')

  const response = await fetch('/api/auth/siwe/nonce')
  if (!response.ok) {
    throw new Error(`Failed to get nonce: ${response.status}`)
  }

  const { nonce } = await response.json()
  console.log('🔐 BackendSIWXMessenger: Received nonce from backend', { nonce })

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
