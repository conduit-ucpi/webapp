/**
 * Tests for classifyAuthError — the function that turns opaque wallet
 * signing failures into actionable user-facing messages.
 *
 * These tests guard the user from a regression we already hit once:
 * Reown's embedded social-login wallet (Magic-backed) failed silently when
 * `tee.express.magiclabs.com` was DNS-blocked, leaving the dashboard with a
 * generic "Authentication failed" and the wizard's submit button greyed out
 * with no diagnostic hint. The classifier maps the inner `Magic RPC Error`
 * to a kind: 'wallet-signing' message that mentions DNS/ad-blockers.
 */

import { classifyAuthError } from '@/lib/auth/classifyAuthError'

describe('classifyAuthError', () => {
  describe('Magic SDK / wallet-signing failures', () => {
    it('classifies the canonical Magic RPC error as wallet-signing', () => {
      const err = new Error('Magic RPC Error: [-32603] Error signing. Please try again')
      const result = classifyAuthError(err)

      expect(result.kind).toBe('wallet-signing')
      expect(result.message.toLowerCase()).toContain('magiclabs.com')
      expect(result.cause).toBe(err)
    })

    it('classifies a bare "Error signing" string as wallet-signing', () => {
      const result = classifyAuthError(new Error('Error signing'))
      expect(result.kind).toBe('wallet-signing')
    })

    it('classifies a -32603 error code as wallet-signing', () => {
      const result = classifyAuthError(new Error('RPC failure code -32603 from provider'))
      expect(result.kind).toBe('wallet-signing')
    })

    it('classifies any error mentioning magiclabs.com as wallet-signing', () => {
      const result = classifyAuthError(new Error('POST https://tee.express.magiclabs.com/v1/wallet/sign/message failed'))
      expect(result.kind).toBe('wallet-signing')
    })

    it('matches case-insensitively', () => {
      const result = classifyAuthError(new Error('MAGIC RPC ERROR: ERROR SIGNING'))
      expect(result.kind).toBe('wallet-signing')
    })

    it('produces a message that mentions concrete user actions', () => {
      const result = classifyAuthError(new Error('Magic RPC Error'))
      // The message must point users at *something* they can do — not be a
      // generic "auth failed". This is the whole point of the classifier.
      const msg = result.message.toLowerCase()
      const mentionsAction =
        msg.includes('dns') ||
        msg.includes('ad block') ||
        msg.includes('network') ||
        msg.includes('1.1.1.1')
      expect(mentionsAction).toBe(true)
    })
  })

  describe('Generic network failures', () => {
    it('classifies "Failed to fetch" as network', () => {
      const result = classifyAuthError(new Error('Failed to fetch'))
      expect(result.kind).toBe('network')
    })

    it('classifies NetworkError as network', () => {
      const result = classifyAuthError(new Error('NetworkError when attempting to fetch'))
      expect(result.kind).toBe('network')
    })

    it('classifies ERR_CONNECTION_REFUSED as network', () => {
      const result = classifyAuthError(new Error('net::ERR_CONNECTION_REFUSED'))
      expect(result.kind).toBe('network')
    })

    it('prefers wallet-signing over network when both signals are present', () => {
      // The Magic failure log line literally contains both "magiclabs.com"
      // and "ERR_CONNECTION" — wallet-signing is more specific and useful.
      const result = classifyAuthError(
        new Error('POST https://tee.express.magiclabs.com/v1/wallet/sign/message net::ERR_CONNECTION_REFUSED')
      )
      expect(result.kind).toBe('wallet-signing')
    })
  })

  describe('Unknown failures', () => {
    it('classifies an unrelated error as unknown and preserves its message', () => {
      const result = classifyAuthError(new Error('Something weird happened'))
      expect(result.kind).toBe('unknown')
      expect(result.message).toBe('Something weird happened')
    })

    it('handles non-Error throwables (strings)', () => {
      const result = classifyAuthError('a plain string error')
      expect(result.kind).toBe('unknown')
      expect(result.message).toBe('a plain string error')
    })

    it('handles null without throwing', () => {
      const result = classifyAuthError(null)
      expect(result.kind).toBe('unknown')
      expect(result.message).toBeTruthy()
    })

    it('handles undefined without throwing', () => {
      const result = classifyAuthError(undefined)
      expect(result.kind).toBe('unknown')
      expect(result.message).toBeTruthy()
    })
  })

  describe('Cause preservation', () => {
    it('keeps the original Error attached as cause for debugging', () => {
      const original = new Error('Magic RPC Error')
      const result = classifyAuthError(original)
      expect(result.cause).toBe(original)
    })
  })
})
