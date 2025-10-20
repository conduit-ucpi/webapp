import { detectDevice } from './deviceDetection'
import { mLog } from './mobileLogger'

/**
 * Configuration for mobile deep link provider.
 * Can be modified for testing.
 */
export const config = {
  triggerDeepLink: (url: string): void => {
    window.location.href = url
  },
}

/**
 * Wraps a WalletConnect provider to automatically trigger mobile deep links
 * before user-action requests (signing, transactions, etc.).
 *
 * This ensures the wallet app is brought to the foreground on mobile devices,
 * fixing the issue where users must manually open the wallet to see pending requests.
 *
 * The wrapper is transparent - it implements the same EIP-1193 interface,
 * so it can be passed to ethers.BrowserProvider without any changes to the rest of the app.
 *
 * Multi-layer protection ensures this ONLY affects:
 * - Mobile/tablet devices (Layer 1)
 * - WalletConnect sessions (Layer 2)
 * - External wallets with peer metadata (Layer 3)
 * - Wallets that provide redirect URLs (Layer 4)
 *
 * Desktop, injected wallets, and other scenarios are unaffected.
 */
export function wrapProviderWithMobileDeepLinks(provider: any, connector?: any): any {
  // ============================================================================
  // LAYER 1: Device Detection
  // ============================================================================
  // Only apply wrapper on mobile/tablet devices
  // Desktop users don't need deep linking (wallet extensions are already in browser)

  const deviceInfo = detectDevice()

  if (!deviceInfo.isMobile && !deviceInfo.isTablet) {
    mLog.info('MobileDeepLink', '⏭️  Desktop device detected - skipping wrapper')
    return provider
  }

  mLog.info('MobileDeepLink', '✓ Layer 1 passed: Mobile/tablet device detected')

  // ============================================================================
  // LAYER 2: WalletConnect Session Verification
  // ============================================================================
  // Only apply wrapper to WalletConnect providers (have active session)
  // Injected wallets (MetaMask extension, etc.) don't have WalletConnect sessions

  // The provider might be wrapped by viem/wagmi, so we need to search for the WalletConnect provider
  // Common paths: provider.transport.provider, provider.provider, provider.walletProvider
  let wcProvider = provider

  // Deep inspection: Log the actual structure of the provider to find where session lives
  const walletBookInstance = (connector as any)?._walletBookInstance
  const walletBook = walletBookInstance?.walletBook

  mLog.info('MobileDeepLink', '🔍 Provider structure inspection:', {
    providerType: typeof provider,
    providerKeys: provider ? Object.keys(provider).slice(0, 20) : [],
    hasTransport: !!provider?.transport,
    transportType: typeof provider?.transport,
    transportKeys: provider?.transport ? Object.keys(provider.transport).slice(0, 20) : [],
    hasTransportValue: !!provider?.transport?.value,
    transportValueType: typeof provider?.transport?.value,
    transportValueKeys: provider?.transport?.value ? Object.keys(provider.transport.value).slice(0, 20) : [],
    hasConnector: !!connector,
    connectorProviderKeys: connector?.provider ? Object.keys(connector.provider).slice(0, 20) : [],
    hasWalletBookInstance: !!walletBookInstance,
    walletBookInstanceType: typeof walletBookInstance,
    walletBookInstanceKeys: walletBookInstance ? Object.keys(walletBookInstance).slice(0, 20) : [],
    hasWalletBook: !!walletBook,
    walletBookType: typeof walletBook,
    walletBookKeys: walletBook ? Object.keys(walletBook).slice(0, 20) : [],
  })

  // Deep dive into walletBook structure if it exists
  if (walletBook) {
    mLog.info('MobileDeepLink', '🔍 Deep dive into walletBook:', {
      hasSession: !!walletBook.session,
      hasProvider: !!walletBook.provider,
      hasConnector: !!walletBook.connector,
      hasWalletProvider: !!walletBook.walletProvider,
      hasClient: !!walletBook.client,
      hasWalletClient: !!walletBook.walletClient,
      allKeys: Object.keys(walletBook).slice(0, 30),
      // CRITICAL: Check what's IN the wallets array
      hasWalletsArray: !!walletBook.wallets,
      walletsIsArray: Array.isArray(walletBook.wallets),
      walletsLength: walletBook.wallets ? walletBook.wallets.length : 0,
      walletsArrayContent: walletBook.wallets ? walletBook.wallets.map((w: any, i: number) => ({
        index: i,
        hasSession: !!w?.session,
        keys: w ? Object.keys(w).slice(0, 10) : []
      })) : []
    })
  }

  // Try to find the WalletConnect provider by searching common nested paths
  const searchPaths = [
    provider,                              // Direct provider
    walletBook,                            // Dynamic's walletBook object (priority search)
    walletBook?.provider,                  // WalletConnect provider in walletBook
    walletBook?.connector,                 // Some wallets store connector in walletBook
    walletBook?.walletProvider,            // Alternative naming in walletBook
    walletBookInstance,                    // Dynamic's internal WalletConnect instance
    walletBookInstance?.provider,          // WalletConnect provider in wallet book instance
    connector?.provider,                   // Dynamic connector's raw provider
    provider?.transport?.provider,         // Viem transport wrapper
    provider?.provider,                    // Common wrapper pattern
    provider?.walletProvider,              // Some connectors use this
    provider?.transport?.value,            // Alternative viem path
  ]

  for (const candidate of searchPaths) {
    if (candidate?.session) {
      wcProvider = candidate
      mLog.info('MobileDeepLink', '✓ Found WalletConnect session in provider chain')
      break
    }
  }

  // CRITICAL FIX (v37.2.25): Search inside walletBook.wallets array
  // The session is NOT on walletBook directly, but inside wallet objects in the wallets array
  if (!wcProvider?.session && walletBook?.wallets && Array.isArray(walletBook.wallets)) {
    mLog.info('MobileDeepLink', `🔍 Searching in walletBook.wallets array (${walletBook.wallets.length} wallets)`)

    for (let i = 0; i < walletBook.wallets.length; i++) {
      const wallet = walletBook.wallets[i]
      if (wallet?.session) {
        wcProvider = wallet
        mLog.info('MobileDeepLink', `✓ Found WalletConnect session in walletBook.wallets[${i}]`)
        break
      }
    }
  }

  // CRITICAL FIX (v37.2.25): Search inside walletBook.groups[].wallets arrays
  // Some configurations might have wallets nested in groups
  if (!wcProvider?.session && walletBook?.groups && Array.isArray(walletBook.groups)) {
    mLog.info('MobileDeepLink', `🔍 Searching in walletBook.groups (${walletBook.groups.length} groups)`)

    for (let i = 0; i < walletBook.groups.length; i++) {
      const group = walletBook.groups[i]
      if (group?.wallets && Array.isArray(group.wallets)) {
        for (let j = 0; j < group.wallets.length; j++) {
          const wallet = group.wallets[j]
          if (wallet?.session) {
            wcProvider = wallet
            mLog.info('MobileDeepLink', `✓ Found WalletConnect session in walletBook.groups[${i}].wallets[${j}]`)
            break
          }
        }
        if (wcProvider?.session) break
      }
    }
  }

  if (!wcProvider?.session) {
    mLog.info('MobileDeepLink', '⏭️  No WalletConnect session found - likely injected wallet, skipping wrapper', {
      hasProvider: !!provider,
      hasTransport: !!provider?.transport,
      hasTransportProvider: !!provider?.transport?.provider,
      hasProviderProperty: !!provider?.provider,
    })
    return provider
  }

  mLog.info('MobileDeepLink', '✓ Layer 2 passed: WalletConnect session exists')

  // ============================================================================
  // LAYER 3: Peer Metadata Verification
  // ============================================================================
  // Only apply wrapper if peer metadata exists (external wallet connected)
  // Incomplete or invalid sessions won't have peer metadata

  if (!wcProvider.session?.peer?.metadata) {
    mLog.info('MobileDeepLink', '⏭️  No peer metadata - incomplete session, skipping wrapper')
    return provider
  }

  mLog.info('MobileDeepLink', '✓ Layer 3 passed: Peer metadata exists')

  // ============================================================================
  // LAYER 4: Redirect Capability Verification
  // ============================================================================
  // Only apply wrapper if wallet provides redirect URLs (can actually deep link)
  // Some wallets might not support deep linking

  const { redirect } = wcProvider.session.peer.metadata

  if (!redirect?.native && !redirect?.universal) {
    mLog.info('MobileDeepLink', '⏭️  No redirect URLs available - wallet does not support deep linking, skipping wrapper')
    return provider
  }

  mLog.info('MobileDeepLink', '✓ Layer 4 passed: Redirect URLs available', {
    native: redirect.native || 'none',
    universal: redirect.universal || 'none'
  })

  // ============================================================================
  // ALL LAYERS PASSED - APPLY WRAPPER
  // ============================================================================

  mLog.info('MobileDeepLink', '✅ All protection layers passed - applying mobile deep link wrapper')

  // Store the original request method
  const originalRequest = provider.request.bind(provider)

  // Override the request method to intercept and trigger deep links
  provider.request = async function(args: { method: string; params?: any[] }) {
    const { method } = args

    mLog.info('MobileDeepLink', `Request intercepted: ${method}`)

    // ============================================================================
    // USER-ACTION METHODS
    // ============================================================================
    // These methods require user interaction in the wallet app
    // We need to trigger a deep link to bring the wallet to the foreground

    const userActionMethods = [
      'personal_sign',              // Standard message signing
      'eth_sign',                   // Raw signing (deprecated but still used)
      'eth_signTypedData',          // Structured data signing (v1)
      'eth_signTypedData_v1',       // Structured data signing (v1)
      'eth_signTypedData_v3',       // Structured data signing (v3)
      'eth_signTypedData_v4',       // Structured data signing (v4) - most common
      'eth_sendTransaction',        // Send transaction
      'eth_signTransaction',        // Sign transaction without sending
      'wallet_switchEthereumChain', // Switch network
      'wallet_addEthereumChain'     // Add new network
    ]

    if (userActionMethods.includes(method)) {
      mLog.info('MobileDeepLink', '🔔 User action required - triggering deep link')

      try {
        // Get the deep link from session metadata
        // Prefer native deep link (e.g., "metamask://") over universal link
        // Native deep links are more direct and reliable
        const deepLink = redirect.native || redirect.universal

        if (deepLink) {
          mLog.info('MobileDeepLink', `🔗 Opening wallet app via: ${deepLink}`)

          // Trigger the deep link - this should open the wallet app
          config.triggerDeepLink(deepLink)

          // Small delay to allow the deep link to process
          // The wallet app should open and the request will be waiting there
          // 300ms is usually enough for the OS to handle the redirect
          await new Promise(resolve => setTimeout(resolve, 300))

          mLog.info('MobileDeepLink', '✅ Deep link triggered, proceeding with request')
        } else {
          mLog.warn('MobileDeepLink', '⚠️  No deep link available (should not happen - Layer 4 should have caught this)')
        }
      } catch (error) {
        mLog.warn('MobileDeepLink', '⚠️  Failed to trigger deep link', { error: error instanceof Error ? error.message : String(error) })
        // Continue anyway - request will still work if user manually opens wallet
        // This is a graceful fallback - same behavior as before the wrapper
      }
    } else {
      mLog.info('MobileDeepLink', `ℹ️  Method "${method}" does not require user action - no deep link needed`)
    }

    // ============================================================================
    // EXECUTE ORIGINAL REQUEST
    // ============================================================================
    // Always call the original request method, whether we triggered a deep link or not
    // The deep link just brings the wallet to foreground - the request still goes through WalletConnect

    return originalRequest(args)
  }

  mLog.info('MobileDeepLink', '✅ Provider wrapped successfully - deep links will trigger for user actions')

  return provider
}
