/**
 * Backend SIWX Storage - Stores sessions in backend instead of localStorage
 *
 * This integrates SIWX session management with our backend authentication system.
 * Sessions are stored server-side via HTTP-only cookies (AUTH-TOKEN).
 * We cache the SIWX session object in sessionStorage so SIWX knows a session exists
 * without requesting a new signature.
 */

import type { CaipNetworkId } from '@reown/appkit-common'
import type { SIWXSession } from '@reown/appkit-controllers'
import type { SIWXStorage } from '@reown/appkit-siwx'

// Storage key for caching SIWX session in sessionStorage
const SIWX_SESSION_STORAGE_KEY = 'conduit_siwx_session'

export class BackendSIWXStorage implements SIWXStorage {
  /**
   * Add a session by storing it in sessionStorage
   *
   * The backend session (AUTH-TOKEN cookie) has already been created by CustomBackendVerifier.
   * We just need to cache the SIWX session object so we can return it when SIWX calls get().
   */
  async add(session: SIWXSession): Promise<void> {
    console.log('🔐 BackendSIWXStorage: add() called - storing session in sessionStorage', {
      hasMessage: !!session.message,
      hasSignature: !!session.signature,
      hasData: !!session.data,
      address: session.data?.accountAddress
    })

    try {
      // Store the session in sessionStorage so we can return it later
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(SIWX_SESSION_STORAGE_KEY, JSON.stringify(session))
        console.log('🔐 BackendSIWXStorage: ✅ Session stored in sessionStorage')
      }
    } catch (error) {
      console.error('🔐 BackendSIWXStorage: Failed to store session', error)
      throw error
    }
  }

  /**
   * Delete a session by calling our backend signout endpoint and clearing sessionStorage
   */
  async delete(chainId: CaipNetworkId, address: string): Promise<void> {
    console.log('🔐 BackendSIWXStorage: delete() called', { chainId, address })

    try {
      // Clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SIWX_SESSION_STORAGE_KEY)
        console.log('🔐 BackendSIWXStorage: Session removed from sessionStorage')
      }

      // Call backend to clear AUTH-TOKEN cookie
      await fetch('/api/auth/siwe/signout', {
        method: 'POST',
        credentials: 'include'
      })

      console.log('🔐 BackendSIWXStorage: ✅ Session deleted from backend')
    } catch (error) {
      console.error('🔐 BackendSIWXStorage: Failed to delete session', error)
      throw error
    }
  }

  /**
   * Get sessions from sessionStorage
   *
   * Returns the cached SIWX session if it exists. The AUTH-TOKEN cookie determines
   * actual validity - it will be validated automatically when API requests are made.
   */
  async get(chainId: CaipNetworkId, address: string): Promise<SIWXSession[]> {
    console.log('🔐 BackendSIWXStorage: get() called', { chainId, address })

    try {
      // Check sessionStorage for cached session
      if (typeof window === 'undefined' || !window.sessionStorage) {
        console.log('🔐 BackendSIWXStorage: sessionStorage not available (SSR)')
        return []
      }

      const storedSession = sessionStorage.getItem(SIWX_SESSION_STORAGE_KEY)

      if (!storedSession) {
        console.log('🔐 BackendSIWXStorage: No session found in sessionStorage')
        return []
      }

      const session: SIWXSession = JSON.parse(storedSession)

      // Verify the session matches the requested address
      if (session.data?.accountAddress?.toLowerCase() === address.toLowerCase()) {
        console.log('🔐 BackendSIWXStorage: ✅ Session found in sessionStorage', {
          address: session.data.accountAddress
        })
        return [session]
      } else {
        console.log('🔐 BackendSIWXStorage: Session address mismatch', {
          stored: session.data?.accountAddress,
          requested: address
        })
        return []
      }
    } catch (error) {
      console.error('🔐 BackendSIWXStorage: Failed to get session', error)
      return []
    }
  }

  /**
   * Set sessions (replace all sessions)
   *
   * For our backend integration, we only support one session at a time.
   */
  async set(sessions: SIWXSession[]): Promise<void> {
    console.log('🔐 BackendSIWXStorage: set() called', {
      count: sessions.length
    })

    if (sessions.length === 0) {
      // Clear all sessions
      console.log('🔐 BackendSIWXStorage: Clearing all sessions')

      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SIWX_SESSION_STORAGE_KEY)
      }

      await fetch('/api/auth/siwe/signout', {
        method: 'POST',
        credentials: 'include'
      })
      return
    }

    // Add the first session (we only support one session via cookie)
    if (sessions.length > 0) {
      await this.add(sessions[0])
    }
  }
}
