/**
 * SIWX (Sign-In With X) Configuration for AppKit
 *
 * This is the modern replacement for SIWE in AppKit 1.8.14+
 * - Multichain support (EVM, Solana, Bitcoin)
 * - Better integration with AppKit
 * - Custom verifier calls our backend for authentication
 */

import { SIWXVerifier, DefaultSIWX } from '@reown/appkit-siwx'
import type { SIWXSession } from '@reown/appkit-controllers'
import { BackendSIWXStorage } from './BackendSIWXStorage'

/**
 * Custom EIP155 Verifier that uses our backend for signature verification
 *
 * Instead of verifying signatures client-side, this proxies to our backend
 * which validates the SIWE signature and creates a session.
 */
class CustomBackendVerifier extends SIWXVerifier {
  readonly chainNamespace = 'eip155' as const

  /**
   * Verify the SIWE signature by calling our backend
   *
   * @param session - Contains the message and signature to verify
   * @returns true if verification succeeds, false otherwise
   */
  async verify(session: SIWXSession): Promise<boolean> {
    try {
      console.log('🔐 SIWX: CustomBackendVerifier.verify() called', {
        hasData: !!session.data,
        hasMessage: !!session.message,
        hasSignature: !!session.signature
      })

      // Extract message and signature from session
      const message = session.message
      const signature = session.signature

      if (!message || !signature) {
        console.error('🔐 SIWX: Missing message or signature')
        return false
      }

      console.log('🔐 SIWX: Calling backend /api/auth/siwe/verify', {
        messageLength: message.length,
        signatureLength: signature.length
      })

      // Call our backend to verify the signature
      const response = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature })
      })

      const isValid = response.ok

      if (isValid) {
        console.log('🔐 SIWX: ✅ Backend verification successful - user authenticated')
      } else {
        console.error('🔐 SIWX: ❌ Backend verification failed:', response.status)
      }

      return isValid
    } catch (error) {
      console.error('🔐 SIWX: Verification error:', error)
      return false
    }
  }
}

/**
 * Create SIWX configuration with custom backend integration
 *
 * Uses DefaultSIWX class with our custom components:
 * - CustomBackendVerifier: Calls our backend to verify signatures
 * - BackendSIWXStorage: Stores sessions in backend via HTTP-only cookies
 * - required: true: Forces authentication, disconnects if user denies
 */
export function createAppKitSIWXConfig() {
  console.log('🔐 SIWX: createAppKitSIWXConfig() called - SIWX configuration is being initialized')

  // Create custom components
  const customVerifier = new CustomBackendVerifier()
  console.log('🔐 SIWX: Custom backend verifier created for EIP155')

  const customStorage = new BackendSIWXStorage()
  console.log('🔐 SIWX: Custom backend storage created - sessions will be stored in backend')

  // Use DefaultSIWX with our custom verifier and storage
  // DefaultSIWX handles createMessage, messenger, signer automatically
  const siwxConfig = new DefaultSIWX({
    verifiers: [customVerifier],
    storage: customStorage,
    required: true // Force authentication - disconnect if user denies signature
  })

  console.log('🔐 SIWX: ✅ SIWX config created successfully with backend integration')
  return siwxConfig
}

// Log that SIWX config module has been loaded
console.log('🔐 SIWX: siwx-config.ts module loaded - SIWX authentication available')
