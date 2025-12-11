/**
 * Test: BackendSIWXMessenger skips SIWX on mobile devices
 *
 * Purpose: Verify that mobile devices (regardless of wallet type) use lazy auth
 * instead of SIWX headless signing, which is unreliable on mobile browsers.
 *
 * This prevents signature prompts immediately after connection on mobile.
 */

import { BackendSIWXMessenger } from '@/lib/auth/BackendSIWXMessenger'

describe('BackendSIWXMessenger - Mobile Device Detection', () => {
  let originalUserAgent: string

  beforeEach(() => {
    // Save original userAgent
    originalUserAgent = navigator.userAgent

    // Mock window.location for the messenger
    delete (global as any).window.location;
    (global as any).window.location = {
      host: 'localhost:3000',
      origin: 'http://localhost:3000'
    }

    // Clear any existing embedded wallet iframes
    document.body.innerHTML = ''

    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    })

    localStorage.clear()
  })

  it('should return SKIP nonce on mobile devices (iPhone)', async () => {
    // Mock mobile iPhone user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    })

    // Create embedded wallet iframe (to prove it still skips even with iframe present)
    const iframe = document.createElement('iframe')
    iframe.src = 'https://secure.walletconnect.com/test'
    document.body.appendChild(iframe)

    const messenger = new BackendSIWXMessenger()

    // Get the internal getNonce function via messenger options
    const getNonceFn = (messenger as any).options.getNonce

    const mockInput = {
      chainId: 'eip155:8453',
      accountAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    // Call getNonce
    const nonce = await getNonceFn(mockInput)

    // Verify the nonce is SKIP (mobile detected)
    expect(nonce).toBe('SKIP_SIWX_LAZY_AUTH')

    console.log('✅ TEST PASSED: Mobile iPhone skips SIWX and uses lazy auth')

    // Cleanup
    iframe.remove()
  })

  it('should return SKIP nonce on mobile devices (Android)', async () => {
    // Mock mobile Android user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
      configurable: true
    })

    // Create embedded wallet iframe (to prove it still skips even with iframe present)
    const iframe = document.createElement('iframe')
    iframe.src = 'https://secure.walletconnect.com/test'
    document.body.appendChild(iframe)

    const messenger = new BackendSIWXMessenger()

    const getNonceFn = (messenger as any).options.getNonce

    const mockInput = {
      chainId: 'eip155:8453',
      accountAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    // Call getNonce
    const nonce = await getNonceFn(mockInput)

    // Verify the nonce is SKIP (mobile detected)
    expect(nonce).toBe('SKIP_SIWX_LAZY_AUTH')

    console.log('✅ TEST PASSED: Mobile Android skips SIWX and uses lazy auth')

    // Cleanup
    iframe.remove()
  })

  it('should return SKIP nonce on tablets (iPad)', async () => {
    // Mock tablet iPad user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true
    })

    const messenger = new BackendSIWXMessenger()

    const getNonceFn = (messenger as any).options.getNonce

    const mockInput = {
      chainId: 'eip155:8453',
      accountAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    // Call getNonce
    const nonce = await getNonceFn(mockInput)

    // Verify the nonce is SKIP (tablet detected as mobile)
    expect(nonce).toBe('SKIP_SIWX_LAZY_AUTH')

    console.log('✅ TEST PASSED: Tablet iPad skips SIWX and uses lazy auth')
  })

  it('should use SIWX on desktop with embedded wallet (not skip)', async () => {
    // Mock desktop Chrome user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      configurable: true
    })

    // Create embedded wallet iframe
    const iframe = document.createElement('iframe')
    iframe.src = 'https://secure.walletconnect.com/test'
    document.body.appendChild(iframe)

    // Mock fetch for nonce endpoint (desktop embedded wallet will call backend)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'desktop-nonce-12345' })
    })

    const messenger = new BackendSIWXMessenger()

    const getNonceFn = (messenger as any).options.getNonce

    const mockInput = {
      chainId: 'eip155:8453',
      accountAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    }

    // Call getNonce
    const nonce = await getNonceFn(mockInput)

    // Verify it did NOT return SKIP nonce (desktop uses real SIWX)
    expect(nonce).not.toBe('SKIP_SIWX_LAZY_AUTH')
    expect(nonce).toBe('desktop-nonce-12345')

    // Verify backend was called
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/siwe/nonce')

    console.log('✅ TEST PASSED: Desktop with embedded wallet uses SIWX headless signing')

    // Cleanup
    iframe.remove()
  })
})
