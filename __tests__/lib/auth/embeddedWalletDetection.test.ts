/**
 * Tests for the embedded-wallet detection used by BackendSIWXMessenger.
 *
 * The messenger decides between:
 *   - Headless SIWX (embedded wallet → silent signature → backend cookie)
 *   - Lazy auth / SKIP nonce (external wallet → no SIWX, signature on first API call)
 *
 * If detection misses a real embedded wallet (e.g. Reown email/Google login),
 * the user falls into the lazy-auth path which never actually triggers,
 * leaving them unauthenticated. These tests guard against that regression.
 */

import { detectEmbeddedWallet } from '@/lib/auth/BackendSIWXMessenger'

function makeStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k)
    },
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

function makeDoc(matchSelector?: string): Pick<Document, 'querySelector'> {
  return {
    querySelector: (selector: string) =>
      matchSelector && selector === matchSelector ? ({} as Element) : null,
  }
}

describe('detectEmbeddedWallet', () => {
  describe('Reown AppKit social/email login (the bug we just fixed)', () => {
    it('detects via @appkit/connected_social key', () => {
      const storage = makeStorage({ '@appkit/connected_social': 'google' })
      const result = detectEmbeddedWallet(storage, makeDoc())

      expect(result.isEmbeddedWallet).toBe(true)
      expect(result.method).toBe('appkit social/email storage')
    })

    it('detects via @appkit-wallet/EMAIL key', () => {
      const storage = makeStorage({ '@appkit-wallet/EMAIL': 'user@example.com' })
      const result = detectEmbeddedWallet(storage, makeDoc())

      expect(result.isEmbeddedWallet).toBe(true)
      expect(result.method).toBe('appkit social/email storage')
    })

    it('detects via @appkit-wallet/SMART_ACCOUNT_ENABLED key', () => {
      const storage = makeStorage({
        '@appkit-wallet/SMART_ACCOUNT_ENABLED': 'true',
      })
      const result = detectEmbeddedWallet(storage, makeDoc())

      expect(result.isEmbeddedWallet).toBe(true)
      expect(result.method).toBe('appkit social/email storage')
    })

    it('detects with the full real-world Reown Google-login key set', () => {
      // Captured from a real Reown Google sign-in session.
      const storage = makeStorage({
        '@appkit-wallet/EMAIL': 'user@example.com',
        '@appkit-wallet/EMAIL_LOGIN_USED_KEY': 'true',
        '@appkit-wallet/LAST_USED_CHAIN_KEY': 'eip155:8453',
        '@appkit-wallet/SMART_ACCOUNT_ENABLED_NETWORKS': '[8453]',
        '@appkit/active_caip_network_id': 'eip155:8453',
        '@appkit/active_namespace': 'eip155',
        '@appkit/connected_namespaces': 'eip155',
        '@appkit/connected_social': 'google',
        '@appkit/connection_status': 'connected',
        '@appkit/connections': '[]',
      })

      const result = detectEmbeddedWallet(storage, makeDoc())

      expect(result.isEmbeddedWallet).toBe(true)
    })
  })

  describe('External wallets (must NOT be flagged as embedded)', () => {
    it('returns false for an empty storage', () => {
      const result = detectEmbeddedWallet(makeStorage({}), makeDoc())
      expect(result.isEmbeddedWallet).toBe(false)
    })

    it('returns false for a plain WalletConnect session without embedded metadata', () => {
      const storage = makeStorage({
        'wc@2:client:0.3//session': JSON.stringify({
          peerMetadata: { name: 'MetaMask', url: 'https://metamask.io' },
        }),
      })

      const result = detectEmbeddedWallet(storage, makeDoc())
      expect(result.isEmbeddedWallet).toBe(false)
    })

    it('returns false for unrelated localStorage keys', () => {
      const storage = makeStorage({
        theme: 'dark',
        dashboardTourCompleted: 'true',
        'onboarding-checklist-seen': 'true',
      })

      const result = detectEmbeddedWallet(storage, makeDoc())
      expect(result.isEmbeddedWallet).toBe(false)
    })
  })

  describe('Legacy detection paths still work', () => {
    it('detects via secure.walletconnect iframe', () => {
      const result = detectEmbeddedWallet(
        makeStorage({}),
        makeDoc('iframe[src*="secure.walletconnect"]')
      )

      expect(result.isEmbeddedWallet).toBe(true)
      expect(result.method).toBe('iframe detected')
    })

    it('detects via Coinbase embedded wallet metadata in wc storage', () => {
      const storage = makeStorage({
        'wc@2:client:0.3//session': JSON.stringify({
          metadata: { name: 'Coinbase Wallet', url: 'https://coinbase.com' },
        }),
      })

      const result = detectEmbeddedWallet(storage, makeDoc())
      expect(result.isEmbeddedWallet).toBe(true)
      expect(result.method).toBe('storage metadata')
    })
  })

  describe('Robustness', () => {
    it('does not throw on malformed JSON in wc@2 storage', () => {
      const storage = makeStorage({
        'wc@2:client:0.3//session': '{not-json',
      })

      expect(() => detectEmbeddedWallet(storage, makeDoc())).not.toThrow()
      expect(detectEmbeddedWallet(storage, makeDoc()).isEmbeddedWallet).toBe(false)
    })

    it('handles a null document (server-side)', () => {
      const storage = makeStorage({ '@appkit/connected_social': 'google' })
      const result = detectEmbeddedWallet(storage, null)

      expect(result.isEmbeddedWallet).toBe(true)
    })
  })
})
