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
 */
async function getBackendNonce(_input: SIWXMessage.Input): Promise<string> {
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
 * Fetches nonces from backend and enforces the correct chain ID
 * for SIWE messages regardless of what network the wallet is connected to.
 */
export class BackendSIWXMessenger extends InformalMessenger {
  private readonly enforcedChainId: number

  constructor(chainId: number) {
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

    this.enforcedChainId = chainId

    console.log('🔐 BackendSIWXMessenger: Initialized with backend nonce fetching', {
      domain,
      uri,
      enforcedChainId: chainId
    })
  }

  /**
   * Override createMessage to enforce the correct chain ID
   * This ensures the SIWE message uses our configured chain (Base)
   * regardless of what network the wallet is currently connected to
   */
  async createMessage(input: SIWXMessage.Input): Promise<SIWXMessage> {
    console.log('🔐 BackendSIWXMessenger: createMessage called with input chainId:', input.chainId)

    // Override the chain ID with our enforced chain ID
    const modifiedInput = {
      ...input,
      chainId: `eip155:${this.enforcedChainId}` as any
    }

    console.log('🔐 BackendSIWXMessenger: Enforcing chain ID:', {
      original: input.chainId,
      enforced: modifiedInput.chainId
    })

    // Call the parent createMessage with the modified input
    return super.createMessage(modifiedInput)
  }
}
