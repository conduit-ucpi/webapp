/**
 * Backend SIWX Storage - Stores sessions in backend instead of localStorage
 *
 * This integrates SIWX session management with our backend authentication system.
 * Sessions are stored server-side via HTTP-only cookies instead of in localStorage.
 */

import type { CaipNetworkId } from '@reown/appkit-common'
import type { SIWXSession } from '@reown/appkit-controllers'
import type { SIWXStorage } from '@reown/appkit-siwx'

export class BackendSIWXStorage implements SIWXStorage {
  /**
   * Add a session by sending it to our backend
   *
   * The backend verifies the signature and creates a server-side session
   * stored in an HTTP-only cookie (AUTH-TOKEN).
   */
  async add(session: SIWXSession): Promise<void> {
    console.log('🔐 BackendSIWXStorage: add() called', {
      hasMessage: !!session.message,
      hasSignature: !!session.signature,
      hasData: !!session.data
    })

    try {
      // The session has already been verified by our CustomBackendVerifier
      // At this point we just need to ensure the backend session is established

      // Check if session already exists
      const checkResponse = await fetch('/api/auth/siwe/session', {
        credentials: 'include' // Include cookies
      })

      if (checkResponse.ok) {
        const existingSession = await checkResponse.json()
        if (existingSession.address) {
          console.log('🔐 BackendSIWXStorage: Backend session already exists', {
            address: existingSession.address
          })
          return // Session already exists, no need to create again
        }
      }

      console.log('🔐 BackendSIWXStorage: ✅ Session will be created by verify() - no additional action needed')
    } catch (error) {
      console.error('🔐 BackendSIWXStorage: Failed to add session', error)
      throw error
    }
  }

  /**
   * Delete a session by calling our backend signout endpoint
   */
  async delete(chainId: CaipNetworkId, address: string): Promise<void> {
    console.log('🔐 BackendSIWXStorage: delete() called', { chainId, address })

    try {
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
   * Get sessions from our backend
   *
   * Returns empty array - our backend manages authentication via HTTP-only cookies,
   * not by reconstructing SIWX sessions. The session check happens at the backend level.
   */
  async get(chainId: CaipNetworkId, address: string): Promise<SIWXSession[]> {
    console.log('🔐 BackendSIWXStorage: get() called', { chainId, address })

    try {
      const response = await fetch('/api/auth/siwe/session', {
        credentials: 'include'
      })

      if (!response.ok) {
        console.log('🔐 BackendSIWXStorage: No active backend session found')
        return []
      }

      const sessionData = await response.json()

      if (!sessionData.address) {
        console.log('🔐 BackendSIWXStorage: Session response missing address')
        return []
      }

      console.log('🔐 BackendSIWXStorage: ✅ Backend session exists', {
        address: sessionData.address
      })

      // Return empty array - backend manages auth via cookies
      // SIWX doesn't need the full session object for our use case
      return []
    } catch (error) {
      console.error('🔐 BackendSIWXStorage: Failed to get session', error)
      return []
    }
  }

  /**
   * Set sessions (replace all sessions)
   *
   * For our backend integration, this is similar to add() since we only
   * support one session at a time (stored in cookie).
   */
  async set(sessions: SIWXSession[]): Promise<void> {
    console.log('🔐 BackendSIWXStorage: set() called', {
      count: sessions.length
    })

    if (sessions.length === 0) {
      // Clear all sessions
      console.log('🔐 BackendSIWXStorage: Clearing all sessions')
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
