/**
 * Embedded-only SIWX
 *
 * Runs Reown Authentication for embedded wallets ONLY — email OTP, Apple and
 * Google. Those are the login types where Reown has verified an email address,
 * and where signing is headless so the user sees no prompt.
 *
 * External wallets (MetaMask, WalletConnect, injected) keep the existing lazy
 * auth path and are never asked to sign at connection time. That was the reason
 * SIWX was disabled wholesale — see reownWalletConnect.tsx: SIWX prompts for a
 * signature even when the nonce says skip.
 *
 * WHY THIS IS A CLASS AND NOT A CONDITIONAL AT createAppKit():
 * `siwx` is fixed when AppKit is constructed, long before we know how the user
 * will connect. So the branch has to happen at runtime, inside the config.
 *
 * HOW THE PROMPT IS SUPPRESSED:
 * AppKit opens its sign-message view when getSessions() comes back empty. For
 * external wallets we therefore return a single placeholder session, which
 * AppKit reads as "already signed in" and leaves alone. That placeholder is
 * never sent anywhere: backend auth for external wallets goes through
 * AuthManager's signature_auth token, not through SIWX.
 */

import { ReownAuthentication } from '@reown/appkit-siwx'
import type { SIWXSession } from '@reown/appkit-controllers'
import { detectEmbeddedWallet } from './BackendSIWXMessenger'
import { mLog } from '@/utils/mobileLogger'

export class EmbeddedOnlySIWX extends ReownAuthentication {
  constructor() {
    // required:false so that if an embedded signature ever does surface a
    // prompt and the user dismisses it, the wallet stays connected rather than
    // being torn down.
    super({ required: false })
  }

  /**
   * Placeholder session handed to AppKit for external wallets so it does not
   * open the sign-message view. Deliberately carries an empty signature — it is
   * a UI-layer marker, never a credential.
   */
  private lazyAuthPlaceholder(chainId: string, address: string): SIWXSession {
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost'
    const origin = typeof window !== 'undefined' ? window.location.origin : `https://${host}`

    return {
      data: {
        accountAddress: address,
        chainId,
        domain: host,
        uri: origin,
        version: '1',
        nonce: 'external-wallet-lazy-auth',
        issuedAt: new Date().toISOString()
      },
      message: 'external-wallet-lazy-auth',
      signature: ''
      // Cast: SIWXMessage carries extra internal members (toString etc.) that we
      // deliberately do not synthesise, since AppKit only reads this for presence.
    } as unknown as SIWXSession
  }

  async getSessions(chainId: string, address: string): Promise<SIWXSession[]> {
    const { isEmbeddedWallet, method } = detectEmbeddedWallet()

    if (!isEmbeddedWallet) {
      mLog.info('EmbeddedOnlySIWX', 'External wallet — skipping SIWX, using lazy auth', {
        chainId,
        detectionMethod: method
      })
      return [this.lazyAuthPlaceholder(chainId, address)]
    }

    mLog.info('EmbeddedOnlySIWX', 'Embedded wallet — running Reown Authentication', {
      chainId,
      detectionMethod: method
    })

    // @ts-expect-error - upstream types CaipNetworkId, we accept the wider string
    return super.getSessions(chainId, address)
  }

  /**
   * Belt and braces: if AppKit ever reaches message creation for an external
   * wallet despite the placeholder above, fail loudly rather than silently
   * prompting the user to sign at connection time.
   */
  async createMessage(input: Parameters<ReownAuthentication['createMessage']>[0]) {
    if (!detectEmbeddedWallet().isEmbeddedWallet) {
      throw new Error('EmbeddedOnlySIWX: refusing to build a SIWX message for an external wallet')
    }
    return super.createMessage(input)
  }
}
