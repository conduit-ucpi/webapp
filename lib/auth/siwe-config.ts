/**
 * SIWE (Sign-In With Ethereum) Configuration for AppKit
 *
 * This enables one-click authentication:
 * - User connects wallet + signs SIWE message in ONE interaction
 * - Works with ALL wallet types (MetaMask, WalletConnect, social login)
 * - Industry standard (EIP-4361) with better security
 */

import { createSIWEConfig } from '@reown/appkit-siwe'

export function createAppKitSIWEConfig() {
  return createSIWEConfig({
    // Called when AppKit needs a nonce for SIWE message
    getNonce: async () => {
      try {
        const response = await fetch('/api/auth/siwe/nonce')
        if (!response.ok) {
          throw new Error(`Failed to get nonce: ${response.statusText}`)
        }
        const { nonce } = await response.json()
        console.log('🔐 SIWE: Got nonce for signing')
        return nonce
      } catch (error) {
        console.error('🔐 SIWE: Failed to get nonce:', error)
        throw error
      }
    },

    // Creates the SIWE message (AppKit calls this internally)
    createMessage: ({ nonce, address, chainId }) => {
      console.log('🔐 SIWE: Creating message for signing', {
        domain: window.location.host,
        address,
        chainId,
        nonceLength: nonce.length
      })

      // Build SIWE message manually (EIP-4361 format)
      const domain = window.location.host
      const uri = window.location.origin
      const statement = 'Sign in to Conduit UCPI'
      const issuedAt = new Date().toISOString()

      const message = `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`

      return message
    },

    // Verify the SIWE signature on backend
    verifyMessage: async ({ message, signature }) => {
      try {
        console.log('🔐 SIWE: Verifying signature with backend', {
          messageLength: message.length,
          signatureLength: signature.length
        })

        const response = await fetch('/api/auth/siwe/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, signature })
        })

        const isValid = response.ok

        if (isValid) {
          console.log('🔐 SIWE: ✅ Signature verified successfully - user authenticated')
        } else {
          console.error('🔐 SIWE: ❌ Signature verification failed:', response.status)
        }

        return isValid
      } catch (error) {
        console.error('🔐 SIWE: Error during verification:', error)
        return false
      }
    },

    // Get current session (if user is already authenticated)
    getSession: async () => {
      try {
        const response = await fetch('/api/auth/siwe/session')
        if (!response.ok) {
          console.log('🔐 SIWE: No active session')
          return null
        }

        const { address, chainId } = await response.json()
        console.log('🔐 SIWE: Active session found', { address, chainId })

        return { address, chainId }
      } catch (error) {
        console.error('🔐 SIWE: Error getting session:', error)
        return null
      }
    },

    // Sign out
    signOut: async () => {
      try {
        console.log('🔐 SIWE: Signing out...')

        await fetch('/api/auth/siwe/signout', { method: 'POST' })

        console.log('🔐 SIWE: ✅ Signed out successfully')
        return true
      } catch (error) {
        console.error('🔐 SIWE: Error during sign out:', error)
        return false
      }
    }
  })
}
