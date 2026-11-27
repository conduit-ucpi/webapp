/**
 * Embedded-wallet SIWX that authenticates OUR backend, at connect, headlessly.
 *
 * ── Why this shape ──────────────────────────────────────────────────────────
 * For a social / email (embedded) login the signing key lives in Reown's secure
 * iframe. A signature can be taken from it in two ways:
 *
 *   1. During connect, through AppKit's SIWX lifecycle. AppKit calls
 *      createMessage(), hands the serialized message to the frame inside
 *      authConnector.connect(), the frame signs it headlessly, and AppKit calls
 *      addSession() with the signature. All of this happens while the connection
 *      is being established — there is no modal gating it.
 *
 *   2. After connect, as a plain personal_sign RPC. AppKit treats that as an
 *      unsafe request and ties it to its own modal: the instant the modal reads
 *      closed with an empty transaction stack it calls rejectRpcRequests(), and
 *      the signature rejects with "Request was aborted" (W3mFrameProvider). After
 *      a social connect the modal is already closed, so on the deployed site that
 *      sign is aborted every time, no matter when it is fired.
 *
 * We used to take route 2 (the adapter's requestAuthentication → lazy
 * personal_sign) and it lost the race. This class takes route 1: it builds OUR
 * EIP-4361 message in createMessage() and posts the frame's signature to OUR
 * /verify in addSession(), so the embedded backend session is established by the
 * same headless signature AppKit already takes at connect. Reown's own
 * authentication endpoint is not involved — we do not need its session, only the
 * signature over our message.
 *
 * External wallets (MetaMask, injected, WalletConnect) never reach this: they
 * sign in their own extension UI and keep the adapter's lazy-auth path. For them
 * getSessions() returns a placeholder so AppKit does not open a sign view.
 */

import { ReownAuthentication } from '@reown/appkit-siwx'
import type { SIWXSession } from '@reown/appkit-controllers'
import { detectEmbeddedWallet } from './embeddedWalletDetection'
import { requestAuthNonce, buildSiweMessage, verifyAuthSignature } from './walletAuthClient'
import { apiFetch } from '@/lib/apiFetch'
import mobileLogger from '@/utils/mobileLogger'

/** Placeholder address AppKit's frame substitutes with the real embedded address before signing. */
const ADDRESS_PLACEHOLDER = '<<AccountAddress>>'

export interface EmbeddedSiwxConfig {
  chainId: number
  serviceLink?: string | null
  termsVersion?: string | null
}

/* Ships straight to the logger instance (so it reaches the box / Grafana on any
   device, unlike mLog which only ships from mobile), and mirrors to the console.
   Quietly no-ops when the debug build flag is off. */
function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const logger: any = mobileLogger
  try { logger?.[level]?.('EmbeddedOnlySIWX', message, data) } catch { /* logging must never break auth */ }
}

export class EmbeddedOnlySIWX extends ReownAuthentication {
  private readonly appConfig: EmbeddedSiwxConfig

  constructor(config: EmbeddedSiwxConfig) {
    // required:false so a dismissed/raced signature never tears the wallet down.
    super({ required: false })
    this.appConfig = config
  }

  /**
   * Placeholder session for external wallets so AppKit does not open its sign
   * view. Empty signature — a UI marker, never a credential. Their backend
   * session is created lazily by the adapter, not here.
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
    } as unknown as SIWXSession
  }

  /**
   * AppKit asks this on load / reconnect to decide whether to prompt. For an
   * embedded wallet we answer from OUR backend session: a 200 from identity is a
   * live session (return one placeholder so AppKit leaves it alone); anything
   * else returns [], which lets a fresh connect run the sign flow below. Never
   * throws — a throw here makes AppKit disconnect the wallet.
   */
  async getSessions(chainId: string, address: string): Promise<SIWXSession[]> {
    const { isEmbeddedWallet, method } = detectEmbeddedWallet()
    if (!isEmbeddedWallet) {
      log('info', 'External wallet — placeholder session, lazy auth', { chainId, method })
      return [this.lazyAuthPlaceholder(chainId, address)]
    }
    try {
      const res = await apiFetch('/api/auth/identity')
      if (res.ok) {
        log('info', 'Embedded wallet — backend session already live', { chainId })
        return [this.lazyAuthPlaceholder(chainId, address)]
      }
      log('info', 'Embedded wallet — no backend session yet, will sign at connect', { chainId, status: res.status })
      return []
    } catch (error) {
      log('warn', 'getSessions identity check failed; treating as no session', {
        message: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * Build OUR EIP-4361 message for the frame to sign. The address is the
   * placeholder AppKit's frame replaces with the real embedded address before
   * signing, and the nonce is one OUR backend issued, so the signature AppKit
   * brings back verifies directly against /api/auth/siwe/verify. Only reached for
   * embedded wallets (external ones get a placeholder from getSessions and never
   * sign here); still gated, loudly, as a guard.
   */
  async createMessage(input: Parameters<ReownAuthentication['createMessage']>[0]) {
    if (!detectEmbeddedWallet().isEmbeddedWallet) {
      throw new Error('EmbeddedOnlySIWX: refusing to build a SIWX message for an external wallet')
    }
    const nonce = await requestAuthNonce()
    const issuedAt = new Date().toISOString()
    const chainId = this.appConfig.chainId
    const serialized = buildSiweMessage({
      address: ADDRESS_PLACEHOLDER,
      chainId,
      nonce,
      serviceLink: this.appConfig.serviceLink,
      termsVersion: this.appConfig.termsVersion,
      issuedAt
    })
    log('info', 'Built backend SIWE message for embedded sign', { chainId, nonceLength: nonce.length })
    // Shape AppKit reads for postMessage; toString() is the bytes the frame signs.
    const message: any = {
      accountAddress: ADDRESS_PLACEHOLDER,
      chainId: (input as any)?.chainId ?? `eip155:${chainId}`,
      domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
      uri: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      version: '1',
      nonce,
      issuedAt,
      notBefore: undefined,
      statement: undefined,
      resources: undefined,
      requestId: undefined,
      expirationTime: undefined,
      toString: () => serialized
    }
    return message
  }

  /**
   * AppKit calls this at connect with the frame's signature over our message.
   * Post it to OUR backend to open the session. Deliberately does NOT call
   * super.addSession (Reown's own endpoint) — we only need our session. Never
   * throws: a throw rejects the whole embedded connect. A rejected signature is
   * logged and left for the adapter's lazy path to retry.
   */
  async addSession(session: SIWXSession): Promise<void> {
    if (!detectEmbeddedWallet().isEmbeddedWallet) {
      return
    }
    const message = (session as any)?.message as string
    const signature = (session as any)?.signature as string
    if (!message || !signature) {
      log('warn', 'addSession called without a message/signature; skipping backend verify')
      return
    }
    try {
      const ok = await verifyAuthSignature(message, signature)
      log(ok ? 'info' : 'error', ok
        ? 'Embedded backend session established via SIWX'
        : 'Backend rejected the embedded SIWX signature')
    } catch (error) {
      log('error', 'Embedded SIWX backend verify threw', {
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
