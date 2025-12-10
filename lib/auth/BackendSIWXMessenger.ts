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
 * - Embedded wallets (social login): Have smart account + EOA, support headless signing
 * - External wallets (WalletConnect, MetaMask): Only EOA, require manual signature popup
 *
 * IMPORTANT: Embedded wallets use EOA for signatures (backend compatibility) but have
 * smart account capabilities that enable headless signing without user prompts.
 */
async function getBackendNonce(input: SIWXMessage.Input): Promise<string> {
  console.log('🔐 BackendSIWXMessenger: getNonce called - full input inspection:', {
    input,
    inputKeys: input ? Object.keys(input) : [],
    stringified: JSON.stringify(input, null, 2)
  })

  // Log all possible wallet detection properties
  console.log('🔐 BackendSIWXMessenger: Wallet detection data:', {
    accountType: (input as any).accountType,
    address: (input as any).address,
    chainNamespace: (input as any).chainNamespace,
    connector: (input as any).connector,
    walletId: (input as any).walletId,
    type: (input as any).type,
    isSmartAccount: (input as any).isSmartAccount,
    hasSmartAccount: (input as any).hasSmartAccount
  })

  // Check if we can access AppKit state from window to detect embedded wallets
  try {
    const appKitState = (window as any).appKitState || (window as any).__APPKIT_STATE__
    if (appKitState) {
      console.log('🔐 BackendSIWXMessenger: AppKit state found:', {
        stateKeys: Object.keys(appKitState),
        connectedWallet: appKitState.connectedWallet,
        connectorType: appKitState.connectorType,
        isEmail: appKitState.isEmail,
        isSocial: appKitState.isSocial
      })
    }
  } catch (e) {
    console.log('🔐 BackendSIWXMessenger: Could not access AppKit state from window')
  }

  // TODO: Implement proper detection once we see what properties are available
  // Need to detect: Embedded wallet (smart account + EOA with headless signing) vs External wallet (only EOA)
  // For now, log everything and proceed with SIWX to see what happens with both wallet types
  console.log('🔐 BackendSIWXMessenger: ⚠️ DETECTION NOT IMPLEMENTED YET - proceeding with SIWX to gather data')
  console.log('🔐 BackendSIWXMessenger: This will help us understand the difference between:')
  console.log('🔐 BackendSIWXMessenger:   - Embedded wallets (smart account + EOA, headless signing works)')
  console.log('🔐 BackendSIWXMessenger:   - External wallets (only EOA, requires popup)')
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
