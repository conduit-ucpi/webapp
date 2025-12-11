/**
 * Test: BackendSIWXMessenger handles external wallets gracefully
 *
 * ISSUE: When a user connects MetaMask (external wallet) on mobile,
 * the SIWX messenger throws "SIWX_SKIP_EXTERNAL" error that gets displayed to the user.
 *
 * EXPECTED: The messenger should return a special signal that allows the connection
 * to proceed with lazy authentication (sign on first API call).
 *
 * This test verifies the fix for the mobile MetaMask connection error.
 */

import { BackendSIWXMessenger } from '@/lib/auth/BackendSIWXMessenger'

describe('BackendSIWXMessenger - External Wallet Handling', () => {
  let messenger: BackendSIWXMessenger

  beforeEach(() => {
    // Mock window.location for the messenger
    delete (global as any).window.location;
    (global as any).window.location = {
      host: 'localhost:3000',
      origin: 'http://localhost:3000'
    }

    // Clear localStorage to simulate external wallet (no embedded wallet session)
    localStorage.clear()

    // Remove any embedded wallet iframes
    document.querySelectorAll('iframe').forEach(iframe => iframe.remove())

    messenger = new BackendSIWXMessenger()
  })

  afterEach(() => {
    localStorage.clear()
  })

  /**
   * RED TEST: This test FAILS initially because BackendSIWXMessenger
   * currently throws "SIWX_SKIP_EXTERNAL" error for external wallets.
   *
   * After the fix, it PASSES by returning a special nonce instead.
   */
  it('should return SKIP nonce for external wallets without throwing error', async () => {
    // SETUP: External wallet (MetaMask) connection on mobile
    // - No embedded wallet iframe
    // - No WalletConnect session in localStorage
    // This simulates a fresh MetaMask connection on mobile

    // Create a mock SIWX message input
    const mockInput = {
      chainId: 'eip155:8453',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    // Get the internal getNonce function via messenger options
    const getNonceFn = (messenger as any).options.getNonce

    // ACT: Call getNonce - should NOT throw an error
    let nonce: string | undefined
    let errorThrown: Error | undefined

    try {
      nonce = await getNonceFn(mockInput)
    } catch (error) {
      errorThrown = error as Error
    }

    // ASSERT: Should NOT throw an error that contains SIWX_SKIP_EXTERNAL
    if (errorThrown) {
      console.error('❌ TEST FAILED: BackendSIWXMessenger threw an error:', errorThrown.message)
      console.error('This error gets displayed to the user on mobile!')
    }

    expect(errorThrown).toBeUndefined()

    // ASSERT: Should return a special SKIP nonce for lazy auth
    expect(nonce).toBe('SKIP_SIWX_LAZY_AUTH')

    console.log('✅ TEST PASSED: BackendSIWXMessenger returns SKIP nonce for external wallets')
  })

  it('should fetch real nonce for embedded wallets (social login)', async () => {
    // SETUP: Embedded wallet (Google social login)
    // Add an iframe to simulate embedded wallet
    const iframe = document.createElement('iframe')
    iframe.src = 'https://secure.walletconnect.com/embedded-wallet'
    document.body.appendChild(iframe)

    // Mock the backend nonce endpoint
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'real-backend-nonce-12345' })
    })

    const mockInput = {
      chainId: 'eip155:8453',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    const getNonceFn = (messenger as any).options.getNonce

    // ACT
    const nonce = await getNonceFn(mockInput)

    // ASSERT: Should call backend and return real nonce
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/siwe/nonce')
    expect(nonce).toBe('real-backend-nonce-12345')

    // Cleanup
    iframe.remove()
  })

  it('should detect embedded wallet via localStorage session metadata', async () => {
    // SETUP: Embedded wallet session in localStorage
    // Note: The detection logic expects the parsed object to have metadata/peerMetadata directly
    const embeddedWalletSession = {
      metadata: {
        name: 'Coinbase Wallet',
        url: 'https://secure.walletconnect.com'
      }
    }

    // Store directly (not as array) to match what detection logic expects
    localStorage.setItem('wc@2:client:0.3//session', JSON.stringify(embeddedWalletSession))

    // Mock the backend nonce endpoint
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'backend-nonce-from-storage-detection' })
    })

    const mockInput = {
      chainId: 'eip155:8453',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    const getNonceFn = (messenger as any).options.getNonce

    // ACT
    const nonce = await getNonceFn(mockInput)

    // ASSERT: Should detect as embedded wallet and fetch real nonce
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/siwe/nonce')
    expect(nonce).toBe('backend-nonce-from-storage-detection')
  })
})
