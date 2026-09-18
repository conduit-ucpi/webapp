/**
 * Is the connected wallet one AppKit embeds (email OTP, Apple, Google), or an external one?
 *
 * The answer decides who is asked to sign at connect time: embedded wallets sign headlessly
 * through Reown Authentication (see EmbeddedOnlySIWX), external wallets are never prompted on
 * connect and prove ownership on first use instead.
 *
 * ⚠️ MOVED VERBATIM out of BackendSIWXMessenger.ts when that file's messenger was deleted as
 *    dead code. Only the log label changed. Detection decides which auth path a user gets, so
 *    a "tidy" during the move would change who can sign in without looking like it.
 */
/**
 * Detect whether the currently connected wallet is an embedded wallet
 * (social/email login with smart-account capability) vs. an external wallet
 * (MetaMask, WalletConnect, etc.).
 *
 * Embedded wallets support headless SIWX signing — no popup. External wallets
 * require a manual signature popup, so we skip SIWX for them and use lazy auth.
 *
 * Pure function: takes only DOM/storage references so it can be unit-tested
 * by injecting mocks. In production, callers pass globals.
 */
export function detectEmbeddedWallet(
  storage: Pick<Storage, 'getItem' | 'length' | 'key'> = typeof localStorage !== 'undefined' ? localStorage : ({ getItem: () => null, length: 0, key: () => null } as any),
  doc: Pick<Document, 'querySelector'> | null = typeof document !== 'undefined' ? document : null
): { isEmbeddedWallet: boolean; method: string } {
  const storageKeys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k) storageKeys.push(k)
  }

  try {
    // Method 0: Reown AppKit embedded wallet (email/social login)
    // Reown's email/Google/social login leaves @appkit-wallet/* and @appkit/connected_social
    // keys in localStorage and creates a smart account capable of headless signing.
    const hasAppkitEmbedded =
      storage.getItem('@appkit/connected_social') !== null ||
      storage.getItem('@appkit-wallet/EMAIL') !== null ||
      storageKeys.some(k => k.startsWith('@appkit-wallet/SMART_ACCOUNT'))

    if (hasAppkitEmbedded) {
      return { isEmbeddedWallet: true, method: 'appkit social/email storage' }
    }

    // Method 1: Embedded wallet iframe (older WalletConnect embedded flow)
    if (doc) {
      const embeddedIframe = doc.querySelector('iframe[src*="secure.walletconnect"]')
      if (embeddedIframe) {
        return { isEmbeddedWallet: true, method: 'iframe detected' }
      }
    }

    // Method 2: Embedded wallet session metadata in WalletConnect storage
    const hasEmbeddedSession = storageKeys.some(key =>
      key.includes('wc@2:client') ||
      key.includes('wc_embedded') ||
      key.includes('wc@2:core') ||
      key.includes('wc@2:universal_provider')
    )

    if (hasEmbeddedSession) {
      const wcData = storageKeys
        .filter(k => k.includes('wc@2'))
        .map(k => {
          try { return JSON.parse(storage.getItem(k) || '{}') } catch { return {} }
        })

      const hasEmbeddedMetadata = wcData.some((data: any) => {
        const metadata = data?.metadata || data?.peerMetadata
        return metadata?.name?.toLowerCase().includes('coinbase') ||
               (metadata?.name?.toLowerCase().includes('wallet') && metadata?.url?.includes('secure.walletconnect'))
      })

      if (hasEmbeddedMetadata) {
        return { isEmbeddedWallet: true, method: 'storage metadata' }
      }
    }
  } catch (e) {
    console.log('🔐 embeddedWalletDetection: Detection error:', e)
  }

  return { isEmbeddedWallet: false, method: 'unknown' }
}
