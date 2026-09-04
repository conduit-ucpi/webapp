import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, base, sepolia, baseSepolia } from '@reown/appkit/networks'
import { ethers } from 'ethers'
import { toHex } from '@/utils/hexUtils'
import { detectDevice } from '@/utils/deviceDetection'
import { wrapProviderWithMobileDeepLinks } from '@/utils/mobileDeepLinkProvider'
import { createAppKitSIWXConfig } from '@/lib/auth/siwx-config'
import { EmbeddedOnlySIWX } from '@/lib/auth/EmbeddedOnlySIWX'
import { siweStatement, buildAuthTokenMessage } from '@/lib/auth/siwe-statement'
import { getSiteNameFromDomain } from '@/utils/siteName'
import { mLog } from '@/utils/mobileLogger'
import { classifyAuthError, type AuthFailure } from '@/lib/auth/classifyAuthError'
import { reportAuthFailure } from '@/lib/auth/reportAuthFailure'
export { classifyAuthError } from '@/lib/auth/classifyAuthError'
export type { AuthFailure, AuthFailureKind } from '@/lib/auth/classifyAuthError'

export type ConnectionMode = 'default' | 'wallet-only' | 'social-only'

export class ReownWalletConnectProvider {
  private appKit: any = null
  private provider: any = null
  private config: any
  private isDesktopQRSession: boolean = false
  private onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void
  private isConnecting: boolean = false
  private connectionMode: ConnectionMode = 'default'
  private lastAuthFailure: AuthFailure | null = null
  /* In-flight initialize(). Callers race: connect() and connectWithSocial()
     both do `if (!this.appKit) await this.initialize()`, and several
     ConnectWalletEmbedded instances can be mounted at once, so the
     check-then-act gap is wide enough for two createAppKit() calls to start
     before either assigns this.appKit. */
  private initPromise: Promise<boolean> | null = null
  /* Kept so applySiwxForMode() can put it back after a wallet-only connect
     cleared it. Built once in runInitialize(). */
  private siwxConfig: any = undefined

  /* Wallet requests that AppKit surfaces as an on-screen prompt (personal_sign
     on an embedded wallet opens its ApproveTransaction view). Closing the modal
     while one is outstanding aborts it, so connect() checks this before it
     tidies the modal away. A counter rather than a flag because nothing stops
     two callers asking for a signature at once. */
  private pendingApprovalRequests = 0

  hasPendingApprovalPrompt(): boolean {
    return this.pendingApprovalRequests > 0
  }

  /**
   * Run a wallet request that needs the user to approve it in AppKit's own UI.
   * Marks the prompt as on screen for as long as the request is in flight.
   */
  async withApprovalPrompt<T>(request: () => Promise<T>): Promise<T> {
    this.pendingApprovalRequests++
    try {
      return await request()
    } finally {
      this.pendingApprovalRequests--
    }
  }

  getLastAuthFailure(): AuthFailure | null {
    return this.lastAuthFailure
  }

  constructor(config: any, onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void) {
    this.config = config
    this.onMobileActionRequired = onMobileActionRequired
  }

  /**
   * Set the connection mode before opening the modal.
   * - 'default': Show all options (wallets + email + social)
   * - 'wallet-only': Show only wallet connectors (MetaMask, Coinbase, etc.)
   * - 'social-only': Show only email/social login, hide wallet list
   *
   * If AppKit is already initialized with a different mode, it will be
   * torn down and reinitialized with the new features on next connect().
   */
  async setConnectionMode(mode: ConnectionMode) {
    if (mode === this.connectionMode) return
    this.connectionMode = mode
    // Use AppKit's updateFeatures() API to change modal options dynamically.
    // createAppKit is a singleton — tearing it down and recreating doesn't work
    // because the second call returns the cached instance with original features.
    if (this.appKit) {
      const features = this.getFeaturesForMode()
      console.log(`🔧 ReownWalletConnect: Updating AppKit features for mode: ${mode}`, features)
      this.appKit.updateFeatures(features)
      this.applySiwxForMode()
    }
  }

  /**
   * SIWX has to be OFF for external wallets, and the switch has to happen
   * before connect() rather than inside the SIWX config.
   *
   * AppKit's WalletConnectConnector.connectWalletConnect() does:
   *
   *     const isAuthenticated = await this.authenticate()   // one-click auth
   *     if (!isAuthenticated) { await this.provider.connect(...) }   // plain pairing
   *
   * and authenticate() -> SIWXUtil.universalProviderAuthenticate() bails with
   * `return false` when there is no siwx configured. That false is the path we
   * want: a normal WalletConnect pairing with no signature at connect time,
   * which is exactly the "external wallets use lazy auth" design.
   *
   * The trap is that universalProviderAuthenticate calls siwx.createMessage()
   * WITHOUT a try/catch, straight after that gate. So EmbeddedOnlySIWX throwing
   * for an external wallet does not fall through to plain pairing - the
   * exception escapes connectWalletConnect() entirely, AppKit reports
   * CONNECT_ERROR, and the connection dies ~14ms after the user picks their
   * wallet, before the deeplink even opens.
   *
   * Clearing siwx via the public updateOptions() reaches the `return false`
   * gate instead, so the throw is never reached.
   */
  private applySiwxForMode() {
    if (!this.appKit) return
    const siwx = this.connectionMode === 'wallet-only' ? undefined : this.siwxConfig
    console.log(
      `🔧 ReownWalletConnect: SIWX ${siwx ? 'enabled' : 'disabled'} for mode: ${this.connectionMode}`
    )
    this.appKit.updateOptions({ siwx })
  }

  private getFeaturesForMode(): Record<string, any> {
    const base = { analytics: false, swaps: false, onramp: false }
    switch (this.connectionMode) {
      case 'wallet-only':
        return { ...base, email: false, socials: false, allWallets: true, connectMethodsOrder: ['wallet'] }
      case 'social-only':
        return { ...base, email: true, socials: ['google', 'apple', 'x', 'discord', 'farcaster'], allWallets: false, emailShowWallets: false, connectMethodsOrder: ['email', 'social'] }
      default:
        return { ...base, email: true, socials: ['google', 'apple', 'x', 'discord', 'farcaster'] }
    }
  }

  /**
   * Idempotent. Returns the same in-flight promise to every concurrent caller
   * so AppKit is built exactly once, no matter how many mounted components
   * race to connect. A failed attempt clears the latch so a retry can proceed.
   */
  async initialize(): Promise<boolean> {
    if (this.appKit) return true
    if (this.initPromise) {
      console.log('🔧 ReownWalletConnect: initialize() already in flight - awaiting the existing AppKit build')
      return this.initPromise
    }
    this.initPromise = this.runInitialize()
    try {
      return await this.initPromise
    } catch (error) {
      this.initPromise = null
      throw error
    }
  }

  private async runInitialize(): Promise<boolean> {
    try {
      console.log('🔧 ReownWalletConnect: ========================================')
      console.log('🔧 ReownWalletConnect: INITIALIZING - This should only appear once per session')
      console.log('🔧 ReownWalletConnect: If you dont see SIWE logs after this, SIWE is broken')
      console.log('🔧 ReownWalletConnect: ========================================')
      console.log('🔧 ReownWalletConnect: Initializing direct WalletConnect integration...')

      // Get project ID from environment
      const projectId = this.config.walletConnectProjectId
      if (!projectId) {
        throw new Error('WALLETCONNECT_PROJECT_ID is required for direct WalletConnect integration')
      }

      // Determine which networks to support based on config
      const chainId = parseInt(this.config.chainId.toString())
      
      let networks
      switch (chainId) {
        case 1:
          networks = [mainnet]
          break
        case 8453:
          networks = [base]
          break
        case 11155111:
          networks = [sepolia]
          break
        case 84532:
          networks = [baseSepolia]
          break
        default:
          // Add Base mainnet as default
          networks = [base]
      }

      console.log('🔧 ReownWalletConnect: Supporting networks:', networks.map(n => `${n.name} (${n.id})`))

      mLog.info('ReownWalletConnect', 'Chain configuration from ENV', {
        chainId,
        networkName: networks[0].name,
        networkId: networks[0].id
      })

      // Create ethers adapter
      const ethersAdapter = new EthersAdapter()

      // SIWX FOR EMBEDDED WALLETS ONLY (email OTP, Apple, Google)
      //
      // Previously SIWX was disabled for everyone, because it prompted for a
      // signature even with a SKIP nonce. That also meant Reown Authentication
      // never ran, so Reown never recorded how the user connected — leaving
      // appKitAccount.connection_method "unknown" and email null, which is why
      // verified emails never reached the backend.
      //
      // EmbeddedOnlySIWX runs Reown Authentication for embedded wallets (where
      // signing is headless and Reown holds a verified email) and short-circuits
      // for external wallets, which keep lazy auth and get no connect-time
      // prompt. See lib/auth/EmbeddedOnlySIWX.ts.
      //
      // Kill switch: set NEXT_PUBLIC_EMBEDDED_SIWX=false to restore the previous
      // disabled-for-everyone behaviour.
      const embeddedSiwxEnabled = process.env.NEXT_PUBLIC_EMBEDDED_SIWX !== 'false'

      mLog.info('ReownWalletConnect', '========================================')
      mLog.info('ReownWalletConnect', `SIWX: ${embeddedSiwxEnabled ? 'EMBEDDED WALLETS ONLY' : 'DISABLED'}`)
      mLog.info('ReownWalletConnect', 'External wallets always use lazy auth (no connect-time prompt)')
      mLog.info('ReownWalletConnect', '========================================')

      const siwxConfig = embeddedSiwxEnabled ? new EmbeddedOnlySIWX() : undefined
      this.siwxConfig = siwxConfig

      /* If the caller already chose wallet-only before AppKit existed (the very
         first connect races setConnectionMode against lazy init), construct
         without SIWX rather than relying on the post-hoc updateOptions call. */
      const siwxForMode = this.connectionMode === 'wallet-only' ? undefined : siwxConfig

      // Create AppKit instance
      console.log('🔧 ReownWalletConnect: Creating AppKit...')
      console.log('🔧 ReownWalletConnect: Default chain ID:', chainId)
      console.log('🔧 ReownWalletConnect: Default network:', networks[0].name)

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://stabledrop.me'

      this.appKit = createAppKit({
        adapters: [ethersAdapter],
        networks: networks as [any, ...any[]], // Type assertion to fix tuple requirement
        defaultNetwork: networks[0], // CRITICAL: Set default network from env variable
        projectId,
        // SIWX runs for embedded (email/social) connects only. External wallets
        // must have it cleared or AppKit's one-click auth throws - see
        // applySiwxForMode(). Gated by NEXT_PUBLIC_EMBEDDED_SIWX, not by device.
        siwx: siwxForMode,
        defaultAccountTypes: {
          eip155: 'eoa' // Force EOA for standard ECDSA signatures (backend compatibility)
        },
        // Shown by AppKit above every signature prompt ("<name> requests a
        // signature"). The app is white-labelled across domains, so a hardcoded
        // name here announces the wrong brand — and an icon pinned to another
        // domain makes the wallet fetch it cross-origin. Both follow the host,
        // the same way Header and MobileDrawer already do. The chain stays out
        // of the description because it is configurable per deployment and
        // AppKit renders it as its own field anyway.
        metadata: {
          name: getSiteNameFromDomain(),
          description: 'Escrow for stablecoin payments',
          url: origin,
          icons: [`${origin}/favicon.ico`]
        },
        features: this.getFeaturesForMode(),
        allowUnsupportedChain: false // Only allow the configured chain from env
      })

      console.log('🔧 ReownWalletConnect: ✅ AppKit initialized successfully')
      return true

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Failed to initialize:', error)
      throw error
    }
  }

  async connect(): Promise<{ success: boolean; user?: any; provider?: any; error?: string; cancelled?: boolean }> {
    // Prevent race conditions for regular connect as well
    if (this.isConnecting) {
      console.log('🔧 ReownWalletConnect: Connection already in progress, waiting...')
      return { success: false, error: 'Connection already in progress' }
    }

    try {
      console.log('🔧 ReownWalletConnect: Starting connection process...')

      this.isConnecting = true

      // Detect if we're on desktop (which would use QR code for mobile wallet)
      const deviceInfo = detectDevice()
      this.isDesktopQRSession = deviceInfo.isDesktop
      const isMobile = deviceInfo.isMobile || deviceInfo.isTablet
      console.log('🔧 ReownWalletConnect: Device type:', deviceInfo.isDesktop ? 'Desktop (QR code flow)' : 'Mobile/Tablet (direct flow)')

      if (!this.appKit) {
        await this.initialize()
      }

      // Check if already connected AFTER AppKit is initialized
      if (this.isConnected()) {
        console.log('🔧 ReownWalletConnect: Already connected after initialization, returning existing connection')
        const address = this.getAddress()
        const provider = this.getProvider()
        return {
          success: true,
          user: { walletAddress: address },
          provider: provider
        }
      }

      // Enhanced session persistence - check if already connected and authenticated
      const existingCaipAddress = this.appKit.getCaipAddress()
      if (existingCaipAddress) {
        console.log('🔧 ReownWalletConnect: Existing session found, checking authentication status...')
        const parts = existingCaipAddress.split(':')
        const address = parts[2]
        const walletProvider = this.appKit.getWalletProvider()

        // Check if we have a valid cached auth token for this session
        const cachedAuthKey = `walletconnect_auth_${address}`
        const cachedAuth = localStorage.getItem(cachedAuthKey)

        if (cachedAuth) {
          try {
            const authData = JSON.parse(cachedAuth)
            // Check if cached auth is still valid (within 24 hours)
            const authAge = Date.now() - authData.timestamp
            const isAuthValid = authAge < (24 * 60 * 60 * 1000) // 24 hours

            if (isAuthValid && authData.walletAddress === address) {
              console.log('🔧 ReownWalletConnect: Valid cached authentication found, skipping sign step')
              return {
                success: true,
                user: { walletAddress: address },
                provider: walletProvider
              }
            } else {
              console.log('🔧 ReownWalletConnect: Cached auth expired or invalid, will re-authenticate')
              localStorage.removeItem(cachedAuthKey)
            }
          } catch (e) {
            console.log('🔧 ReownWalletConnect: Failed to parse cached auth, will re-authenticate')
            localStorage.removeItem(cachedAuthKey)
          }
        }

        if (walletProvider) {
          // Test that the provider is working and on the correct network
          try {
            const accounts = await walletProvider.request({ method: 'eth_accounts' })
            if (accounts && accounts.length > 0) {
              // Check if we're on the correct network
              const currentChainId = await walletProvider.request({ method: 'eth_chainId' })
              const expectedChainId = this.config.chainId // Use chainId from config (decimal from ENV)
              const currentChainIdNum = typeof currentChainId === 'string'
                ? (currentChainId.startsWith('0x') ? parseInt(currentChainId, 16) : parseInt(currentChainId, 10))
                : currentChainId

              console.log('🔧 ReownWalletConnect: Existing connection network check - current:', currentChainIdNum, 'expected:', expectedChainId)

              if (currentChainIdNum === expectedChainId) {
                console.log('🔧 ReownWalletConnect: ✅ Existing connection is ready and on correct network:', this.getNetworkName(currentChainIdNum))
                return {
                  success: true,
                  user: { walletAddress: address },
                  provider: walletProvider
                }
              } else {
                console.log('🔧 ReownWalletConnect: Existing connection on wrong network')
                console.log('🔧 ReownWalletConnect: Current:', this.getNetworkName(currentChainIdNum), '- Expected:', this.getNetworkName(expectedChainId))
                console.log('🔧 ReownWalletConnect: Will request network switch during connection flow')
              }
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Existing connection not working, reconnecting...', error)
          }
        }
      }

      // Open the connection modal
      console.log('🔧 ReownWalletConnect: Opening connection modal...')
      await this.appKit.open()

      // Wait for connection to be established
      // AppKit manages the connection state internally
      return new Promise((resolve) => {
        let isResolved = false
        let checkAttempts = 0
        const maxAttempts = 300 // SOCIAL LOGIN FIX: 5 minutes to allow for slow OAuth flows
        let hasInitiatedConnection = false

        // Track cleanup functions
        const cleanupFunctions: Array<() => void> = []

        let resolveOnce = (result: any) => {
          if (!isResolved) {
            isResolved = true

            // Clean up all listeners and the poll timer
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (isMobile) {
              window.removeEventListener('focus', handleFocus)
            }
            stopPolling()

            // Execute all cleanup functions
            cleanupFunctions.forEach(cleanup => {
              try {
                cleanup()
              } catch (error) {
                console.warn('🔧 ReownWalletConnect: Cleanup error:', error)
              }
            })

            resolve(result)
          }
        }

        /**
         * Android/iOS suspend a backgrounded tab, which kills the WalletConnect
         * relay WebSocket. The wallet still publishes its approval, but with the
         * socket down nothing is subscribed to receive it, and universal-provider
         * does not always re-subscribe by itself when the tab comes back - so the
         * dapp waits forever for a message that was delivered while it was asleep.
         *
         * Reports the transport state on every return to the foreground, and
         * restarts it when it is down. Restarting a healthy transport is a no-op,
         * so this is safe to run on every focus.
         *
         * getUniversalProvider() is a public AppKit method; the relayer beneath it
         * is not, hence the defensive access.
         */
        /* How long to let WalletConnect's own reconnect run before overriding it.
           A healthy reopen lands well inside this; the stuck state observed on
           Android sat at connecting:true for 80s+ without progressing. */
        const STUCK_RECONNECT_MS = 8000
        let connectingSince: number | null = null

        const reviveRelayIfDropped = async (trigger: string) => {
          try {
            // getUniversalProvider() returns a Promise - without the await this
            // reads .client off a Promise and silently finds nothing.
            const provider: any = await this.appKit?.getUniversalProvider?.()
            const relayer: any = provider?.client?.core?.relayer
            if (!relayer) {
              console.log(`🔧 ReownWalletConnect: [${trigger}] no relayer available yet`, {
                hasProvider: Boolean(provider)
              })
              return
            }

            console.log(`🔧 ReownWalletConnect: [${trigger}] relay state`, {
              relayerConnected: relayer.connected,
              relayerConnecting: relayer.connecting,
              transportExplicitlyClosed: relayer.transportExplicitlyClosed,
              hasSession: Boolean(provider?.session),
              pairings: provider?.client?.core?.pairing?.getPairings?.().length ?? 'n/a'
            })

            if (relayer.connected) {
              connectingSince = null
              return
            }

            /* Two failure modes, opposite remedies.
               Barging in on a healthy reconnect breaks it: restartTransport()
               closes and reopens the socket, aborting the in-flight attempt and
               restarting the clock. focus and visibility both fire on Android,
               so that produced competing loops that cancelled each other.
               But standing back unconditionally is no better - observed on
               Android Chrome, WalletConnect's own reconnect can sit at
               connecting:true indefinitely (80s+, no error, no progress) after
               the tab is suspended, and then nobody ever recovers it.
               So: give its own attempt a grace period, then take over. */
            if (relayer.connecting) {
              const now = Date.now()
              if (connectingSince === null) connectingSince = now
              const stuckFor = now - connectingSince

              if (stuckFor < STUCK_RECONNECT_MS) {
                console.log(
                  `🔧 ReownWalletConnect: [${trigger}] reconnect in flight for ${stuckFor}ms - leaving it alone`
                )
                return
              }
              console.log(
                `🔧 ReownWalletConnect: [${trigger}] reconnect stuck for ${stuckFor}ms - taking over`
              )
            }

            if (typeof relayer.restartTransport !== 'function') return

            console.log(`🔧 ReownWalletConnect: [${trigger}] restarting transport`)
            connectingSince = null
            await relayer.restartTransport()
            console.log(`🔧 ReownWalletConnect: [${trigger}] transport restarted`, {
              relayerConnected: relayer.connected,
              relayerConnecting: relayer.connecting
            })
          } catch (error) {
            console.warn(`🔧 ReownWalletConnect: [${trigger}] relay revive failed`, error)
          }
        }

        // Add visibility change listener to detect when user returns from wallet app
        // SOCIAL LOGIN FIX: Give WalletConnect plenty of time to process OAuth callbacks
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && !isResolved) {
            console.log('🔧 ReownWalletConnect: App became visible, giving WalletConnect time to process OAuth...')
            void reviveRelayIfDropped('visibility')
            // Give WalletConnect time to exchange OAuth tokens and establish session
            setTimeout(() => {
              if (!isResolved) {
                console.log('🔧 ReownWalletConnect: Checking connection after visibility change...')
                checkConnection()
              }
            }, 2000) // Increased from 300ms to 2000ms for social login OAuth processing
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // On mobile, also use focus event as backup for detection
        // SOCIAL LOGIN FIX: Give WalletConnect plenty of time to process OAuth callbacks
        const handleFocus = () => {
          if (!isResolved) {
            console.log('🔧 ReownWalletConnect: Window focused, giving WalletConnect time to process OAuth...')
            void reviveRelayIfDropped('focus')
            // Give WalletConnect time to exchange OAuth tokens and establish session
            setTimeout(() => {
              if (!isResolved) {
                console.log('🔧 ReownWalletConnect: Checking connection after focus...')
                checkConnection()
              }
            }, 2000) // Increased from 300ms to 2000ms for social login OAuth processing
          }
        }
        if (isMobile) {
          window.addEventListener('focus', handleFocus)
        }

        /* ONE poll chain, never more.
           checkConnection() re-arms itself on every miss, and it is also called
           directly from the visibility/focus handlers and from AppKit and
           provider events. Each of those used to start its own self-scheduling
           chain, and a 2s mobile interval span­ned yet another chain per tick,
           so concurrent pollers grew without bound - burning through
           maxAttempts in a fraction of the intended window and hammering
           AppKit while it was trying to settle the session.

           schedulePoll() cancels any pending tick before arming the next, so
           however many callers ask for a check there is only ever one timer
           outstanding, and maxAttempts once again means what the constant says. */
        let pollTimer: ReturnType<typeof setTimeout> | null = null

        const schedulePoll = (delayMs: number) => {
          if (isResolved) return
          if (pollTimer) clearTimeout(pollTimer)
          pollTimer = setTimeout(() => {
            pollTimer = null
            checkConnection()
          }, delayMs)
        }

        const stopPolling = () => {
          if (pollTimer) {
            clearTimeout(pollTimer)
            pollTimer = null
          }
        }

        const checkConnection = async () => {
          if (isResolved) return // Don't continue if already resolved

          checkAttempts++
          if (checkAttempts > maxAttempts) {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            resolveOnce({
              success: false,
              error: 'Connection timeout - user may have cancelled'
            })
            return
          }

          try {
            // Check if we have an active connection by getting the account
            // The AppKit modal state is managed internally
            const caipAddress = this.appKit.getCaipAddress()

            // TRUST WALLETCONNECT: Removed modal close detection logic
            // For social login (Google, etc), the modal closes during OAuth flow
            // WalletConnect/Reown will handle session restoration when user returns
            // We should NOT treat modal close as cancellation - just wait for caipAddress
            // Let WalletConnect handle all the OAuth complexity internally

            // Check if we detect any wallet provider activity indicating connection attempt
            const walletProvider = this.appKit.getWalletProvider()
            if (walletProvider && !hasInitiatedConnection) {
              console.log('🔧 ReownWalletConnect: Wallet provider detected, connection initiated')
              hasInitiatedConnection = true
              // No separate mobile interval - the single poll chain below already
              // re-checks every second on every platform.
            }

            if (caipAddress) {
              // Extract address from CAIP format (e.g., "eip155:8453:0x...")
              const parts = caipAddress.split(':')
              const address = parts[2] // The address is the third part

              console.log('🔧 ReownWalletConnect: ✅ Connected successfully')
              console.log('🔧 ReownWalletConnect: CAIP Address:', caipAddress)
              console.log('🔧 ReownWalletConnect: Address:', address)

              // Get the wallet provider (UniversalProvider)
              const walletProvider = this.appKit.getWalletProvider()

              if (!walletProvider) {
                throw new Error('No wallet provider available from AppKit')
              }

              // TRUST WALLETCONNECT: If we have a CAIP address, the connection is established
              // Don't do extra verification that causes infinite retry loops on desktop social login
              console.log('🔧 ReownWalletConnect: Provider ready - trusting WalletConnect connection')

              // Clean up visibility listener
              document.removeEventListener('visibilitychange', handleVisibilityChange)

              // Verify and switch network BEFORE closing modal - keeps it as one flow
              try {
                const currentChainId = await walletProvider.request({ method: 'eth_chainId' })
                const expectedChainId = this.config.chainId // Use chainId from config (decimal from ENV)
                const currentChainIdNum = typeof currentChainId === 'string'
                  ? (currentChainId.startsWith('0x') ? parseInt(currentChainId, 16) : parseInt(currentChainId, 10))
                  : currentChainId

                console.log('🔧 ReownWalletConnect: Network check - current:', currentChainIdNum, 'expected:', expectedChainId)

                if (currentChainIdNum !== expectedChainId) {
                  console.log('🔧 ReownWalletConnect: Wrong network detected - switching to correct network as part of connection flow')
                  console.log('🔧 ReownWalletConnect: Target network - decimal:', expectedChainId, 'name:', this.getNetworkName(expectedChainId))

                  try {
                    // Convert decimal chainId to hex for the wallet_switchEthereumChain request
                    const expectedChainIdHex = toHex(expectedChainId)
                    console.log('🔧 ReownWalletConnect: Requesting network switch to hex:', expectedChainIdHex)

                    // Network switch request - wallet will show modal to user
                    // Keeping AppKit modal open makes this feel like part of the connection flow
                    await walletProvider.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: expectedChainIdHex }]
                    })

                    // Verify the switch worked
                    const newChainId = await walletProvider.request({ method: 'eth_chainId' })
                    const newChainIdNum = typeof newChainId === 'string'
                      ? (newChainId.startsWith('0x') ? parseInt(newChainId, 16) : parseInt(newChainId, 10))
                      : newChainId

                    if (newChainIdNum !== expectedChainId) {
                      console.warn('🔧 ReownWalletConnect: Network switch rejected or failed - still on:', newChainIdNum)
                      console.warn('🔧 ReownWalletConnect: User may need to manually switch to:', this.getNetworkName(expectedChainId))
                      // Continue anyway - some wallets don't support programmatic switching
                    } else {
                      console.log('🔧 ReownWalletConnect: ✅ Network switched successfully to:', this.getNetworkName(newChainIdNum))
                    }
                  } catch (switchError) {
                    console.warn('🔧 ReownWalletConnect: Network switch request failed:', switchError)
                    console.warn('🔧 ReownWalletConnect: User may need to manually switch to:', this.getNetworkName(expectedChainId))
                    // Continue anyway - user might switch manually later
                  }
                } else {
                  console.log('🔧 ReownWalletConnect: ✅ Already on correct network:', this.getNetworkName(currentChainIdNum))
                }
              } catch (chainError) {
                console.warn('🔧 ReownWalletConnect: Could not verify network:', chainError)
                // Continue anyway
              }

              /* Close the modal after network verification/switch completes -
                 UNLESS the embedded wallet is currently asking the user to
                 approve something.

                 The app does not wait for connect() to resolve before it starts
                 working: AuthManager's subscribeAccount listener flips
                 isConnected as soon as AppKit publishes the address, /create
                 renders the wizard, its first API call 401s and lazy auth asks
                 the embedded wallet to sign - all while this poll loop is still
                 running. AppKit answers that personal_sign by opening its own
                 modal on the ApproveTransaction view, and closing the modal
                 while an unsafe RPC request is in flight makes AppKit abort it
                 (appkit: PublicStateController.subscribeOpen -> rejectRpcRequests),
                 so the prompt vanishes before the user can press Sign and the
                 signature rejects with "Request was aborted".

                 AppKit closes the modal itself once the request settles, so
                 skipping the close here costs nothing. */
              if (this.hasPendingApprovalPrompt()) {
                console.log('🔧 ReownWalletConnect: Leaving modal open - wallet approval prompt is on screen')
              } else {
                console.log('🔧 ReownWalletConnect: Closing modal - connection and network setup complete')
                await this.appKit.close()
              }

              resolveOnce({
                success: true,
                user: { walletAddress: address },
                provider: walletProvider
              })
            } else {
              /* Watch the relay from the poll loop too, not just on
                 focus/visibility - otherwise a transport that dies while the
                 user sits in the wallet is only noticed if they happen to
                 switch back and forth. Every 5th tick is roughly every 5s. */
              if (checkAttempts % 5 === 0) {
                void reviveRelayIfDropped('poll')
              }
              // MOBILE FIX: Slower polling to let WalletConnect sync naturally
              // Check again in 1000ms instead of 500ms to reduce interference
              schedulePoll(1000)
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Waiting for connection...', error)
            schedulePoll(1000)
          }
        }

        // Set up event listeners for AppKit state changes
        const subscribeToEvents = () => {
          try {
            // Subscribe to AppKit events if available
            if (this.appKit.subscribeEvents) {
              console.log('🔧 ReownWalletConnect: Setting up event subscriptions...')

              const unsubscribe = this.appKit.subscribeEvents((event: any) => {
                console.log('🔧 ReownWalletConnect: AppKit event:', event)

                // Check for events that indicate wallet selection/connection attempt
                if (event?.type === 'wallet_selected' ||
                    event?.type === 'connect_started' ||
                    event?.type === 'session_request') {
                  console.log('🔧 ReownWalletConnect: Connection initiated event detected')
                  if (!hasInitiatedConnection) {
                    hasInitiatedConnection = true
                  }
                }

                // Check on any connection-related event
                if (event?.type === 'session_event' ||
                    event?.type === 'connect' ||
                    event?.type === 'session_update' ||
                    event?.name === 'accountsChanged') {
                  console.log('🔧 ReownWalletConnect: Session event detected, checking connection...')
                  checkConnection()
                }
              })

              // Add cleanup function
              if (unsubscribe) {
                cleanupFunctions.push(() => unsubscribe())
              }
            }

            // Also try to subscribe to the underlying provider events if available
            const provider = this.appKit.getWalletProvider()
            if (provider && provider.on) {
              console.log('🔧 ReownWalletConnect: Setting up provider event listeners...')

              const handleConnect = () => {
                console.log('🔧 ReownWalletConnect: Provider connect event, checking connection...')
                if (!hasInitiatedConnection) {
                  console.log('🔧 ReownWalletConnect: Connection initiated via provider event')
                  hasInitiatedConnection = true
                }
                checkConnection()
              }

              provider.on('connect', handleConnect)
              provider.on('session_event', handleConnect)
              provider.on('session_update', handleConnect)

              // Add cleanup function.
              // EIP-1193 mandates removeListener; off() is an EventEmitter extra
              // that MetaMask's inpage provider doesn't always expose. Gating
              // removal on off() alone leaks all three handlers on every connect.
              cleanupFunctions.push(() => {
                const remove = (provider.off || provider.removeListener)?.bind(provider)
                if (!remove) {
                  console.warn('🔧 ReownWalletConnect: provider exposes neither off() nor removeListener() - listeners will leak')
                  return
                }
                remove('connect', handleConnect)
                remove('session_event', handleConnect)
                remove('session_update', handleConnect)
              })
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Could not set up event subscriptions:', error)
          }
        }

        // Closing the modal without picking anything is a cancellation, so the
        // caller can put the page back the way it was instead of sitting on a
        // dead "Connecting..." button until the 5 minute timeout.
        //
        // The subtlety this has to respect is the one checkConnection() warns
        // about: social login legitimately closes the modal mid-flow while the
        // OAuth leg completes, and that close must NOT count as a cancel. So we
        // key off whether the user actually chose something rather than off the
        // connection mode - a close after SOCIAL_LOGIN_STARTED keeps waiting,
        // a close with nothing chosen cancels.
        //
        // Email/OTP is deliberately absent from this list: that flow keeps the
        // modal open the whole way through, so closing it really is a cancel.
        const SOCIAL_CHOICE_EVENTS = new Set([
          'CONNECT_SUCCESS',
          'SOCIAL_LOGIN_STARTED',
          'SOCIAL_LOGIN_REQUEST_USER_DATA',
          'SOCIAL_LOGIN_SUCCESS'
        ])
        // Backing out of a social attempt drops the user back on the picker, so
        // the next close is a cancel again.
        const CHOICE_RESET_EVENTS = new Set([
          'SOCIAL_LOGIN_CANCELED',
          'SOCIAL_LOGIN_ERROR',
          'CONNECT_ERROR'
        ])
        let socialChoiceMade = false
        let walletChoiceMade = false

        // Social login blocks the cancel on every platform - the modal closing
        // is part of its OAuth leg. Picking a wallet only blocks it on mobile,
        // where the modal closes as the wallet app takes over; on desktop the
        // flow stays put on a QR screen, so closing that is the user giving up.
        const choiceBlocksCancel = () =>
          socialChoiceMade || (isMobile && (walletChoiceMade || hasInitiatedConnection))

        const subscribeToModalDismissal = () => {
          if (typeof this.appKit.subscribeState !== 'function') return

          // subscribeEvents hands back the whole EventsController state; the
          // event name lives at state.data.event.
          if (typeof this.appKit.subscribeEvents === 'function') {
            const unsubscribeEvents = this.appKit.subscribeEvents((state: any) => {
              const name = state?.data?.event
              if (!name) return
              if (SOCIAL_CHOICE_EVENTS.has(name)) {
                socialChoiceMade = true
              } else if (name === 'SELECT_WALLET') {
                walletChoiceMade = true
              } else if (CHOICE_RESET_EVENTS.has(name)) {
                socialChoiceMade = false
                walletChoiceMade = false
              }
            })
            if (unsubscribeEvents) {
              cleanupFunctions.push(() => unsubscribeEvents())
            }
          }

          // Seed from current state: open() has already been awaited above, but
          // read it rather than assume, so a close can only follow a real open.
          let sawOpen = false
          try {
            sawOpen = !!this.appKit.getState?.().open
          } catch {
            sawOpen = true
          }

          const unsubscribe = this.appKit.subscribeState((state: any) => {
            if (state?.open) {
              sawOpen = true
              return
            }
            if (!sawOpen || isResolved) return

            // The success path closes the modal itself before resolving, so give
            // that a beat to land before calling this a cancellation.
            setTimeout(() => {
              if (isResolved) return
              // Something was chosen and the connection is still in flight.
              if (choiceBlocksCancel()) return
              try {
                if (this.appKit.getCaipAddress()) return
              } catch {
                // Fall through - no address means nothing to keep waiting for.
              }

              console.log('🔧 ReownWalletConnect: Modal dismissed without choosing - cancelling')
              resolveOnce({
                success: false,
                cancelled: true,
                error: 'Connection cancelled'
              })
            }, 500)
          })

          if (unsubscribe) {
            cleanupFunctions.push(() => unsubscribe())
          }
        }

        // Set up event subscriptions
        subscribeToEvents()
        subscribeToModalDismissal()

        // Start checking
        checkConnection()
      })

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Connection failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      }
    } finally {
      this.isConnecting = false
    }
  }

  async disconnect() {
    try {
      // Clear Web3Service singleton to ensure fresh provider on next login
      try {
        const { Web3Service } = await import('@/lib/web3');
        Web3Service.clearInstance();
        console.log('🔧 ReownWalletConnect: Cleared Web3Service singleton');
      } catch (error) {
        console.warn('Could not clear Web3Service singleton:', error);
      }

      if (this.appKit) {
        await this.appKit.disconnect()
        console.log('🔧 ReownWalletConnect: ✅ Disconnected successfully')
      }
    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Disconnect failed:', error)
    }
  }

  /**
   * Manually request SIWX authentication
   * Used as fallback when auto-authentication during connection doesn't complete
   *
   * This manually creates and signs a SIWE message, then sends it to the backend
   */
  async requestAuthentication(): Promise<boolean> {
    this.lastAuthFailure = null
    try {
      console.log('🔧 ReownWalletConnect: Manually requesting SIWX authentication...')

      if (!this.appKit) {
        console.error('🔧 ReownWalletConnect: AppKit not initialized')
        return false
      }

      if (!this.isConnected()) {
        console.error('🔧 ReownWalletConnect: Not connected - cannot request authentication')
        return false
      }

      const walletProvider = this.getProvider()
      let address = this.appKit.getAddress()

      if (!address) {
        console.error('🔧 ReownWalletConnect: No address available')
        return false
      }

      // Embedded wallets (social login) can present a smart account, which cannot
      // produce an ECDSA signature. getAccount() is AppKit's public, typed view of
      // the connected accounts and carries a type discriminator per account.
      //
      // This only VALIDATES - it deliberately does not swap in a different address.
      // The signature has to prove ownership of the wallet registered against the
      // user in user-service, and that is the address AppKit reports as connected.
      // Signing with some other EOA would produce a signature the backend cannot
      // match to the account, so a mismatch is a hard failure, not a silent switch.
      //
      // In practice createAppKit() is configured with defaultAccountTypes.eip155 =
      // 'eoa', so the connected account should already be signable; this catches the
      // case where that guarantee stops holding.
      const account = this.appKit.getAccount?.('eip155')
      const connected = account?.allAccounts?.find(
        (a: { address: string }) => a.address?.toLowerCase() === address?.toLowerCase()
      )

      if (connected && connected.type === 'smartAccount') {
        console.error('🔧 ReownWalletConnect: Connected account is a smart account and cannot sign', {
          address,
          availableTypes: account?.allAccounts?.map((a: { type: string }) => a.type)
        })
        this.lastAuthFailure = {
          kind: 'wallet-signing',
          message: 'This wallet cannot sign messages. Reconnect and choose a standard wallet account.'
        }
        return false
      }

      if (account?.embeddedWalletInfo) {
        console.log('🔧 ReownWalletConnect: Embedded wallet signing', {
          address,
          accountType: connected?.type ?? 'unknown',
          authProvider: account.embeddedWalletInfo.authProvider
        })
      }

      // CRITICAL: Verify and switch to correct network BEFORE creating SIWE message
      // Otherwise user might sign on wrong chain (e.g., BNB instead of Base)
      console.log('🔧 ReownWalletConnect: Verifying network before authentication...')

      try {
        const currentChainId = await walletProvider.request({ method: 'eth_chainId' })
        const expectedChainId = this.config.chainId // Use chainId from config (decimal from ENV)
        const currentChainIdNum = typeof currentChainId === 'string'
          ? (currentChainId.startsWith('0x') ? parseInt(currentChainId, 16) : parseInt(currentChainId, 10))
          : currentChainId

        console.log('🔧 ReownWalletConnect: Network check before auth - current:', currentChainIdNum, 'expected:', expectedChainId)

        if (currentChainIdNum !== expectedChainId) {
          console.log('🔧 ReownWalletConnect: ⚠️ Wrong network - switching before authentication')
          console.log('🔧 ReownWalletConnect: Target network - decimal:', expectedChainId, 'name:', this.getNetworkName(expectedChainId))

          try {
            // Convert decimal chainId to hex for the wallet_switchEthereumChain request
            const expectedChainIdHex = toHex(expectedChainId)
            console.log('🔧 ReownWalletConnect: Requesting network switch to hex:', expectedChainIdHex)

            // Network switch request - wallet will show modal to user
            await walletProvider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: expectedChainIdHex }]
            })

            // Verify the switch worked
            const newChainId = await walletProvider.request({ method: 'eth_chainId' })
            const newChainIdNum = typeof newChainId === 'string'
              ? (newChainId.startsWith('0x') ? parseInt(newChainId, 16) : parseInt(newChainId, 10))
              : newChainId

            if (newChainIdNum !== expectedChainId) {
              console.error('🔧 ReownWalletConnect: ❌ Network switch failed - still on:', this.getNetworkName(newChainIdNum))
              console.error('🔧 ReownWalletConnect: Cannot authenticate on wrong network')
              return false
            } else {
              console.log('🔧 ReownWalletConnect: ✅ Network switched successfully to:', this.getNetworkName(newChainIdNum))
            }
          } catch (switchError) {
            console.error('🔧 ReownWalletConnect: ❌ Network switch request failed:', switchError)
            console.error('🔧 ReownWalletConnect: Cannot authenticate - user must be on', this.getNetworkName(expectedChainId))
            return false
          }
        } else {
          console.log('🔧 ReownWalletConnect: ✅ Already on correct network:', this.getNetworkName(currentChainIdNum))
        }
      } catch (chainError) {
        console.warn('🔧 ReownWalletConnect: ⚠️ Could not verify network, proceeding anyway:', chainError)
      }

      console.log('🔧 ReownWalletConnect: Creating SIWE message manually', { address })

      // Step 1: Get a nonce from the backend
      const nonceResponse = await fetch('/api/auth/siwe/nonce')
      if (!nonceResponse.ok) {
        console.error('🔧 ReownWalletConnect: Failed to get nonce')
        return false
      }
      const { nonce } = await nonceResponse.json()
      console.log('🔧 ReownWalletConnect: Got nonce from backend')

      // Step 2: Create SIWE message manually (avoiding siwe library parser issues)
      // Construct message string directly following EIP-4361 format
      // ALWAYS use config chainId (not wallet's current network) for SIWE message
      const chainId = this.config.chainId
      const domain = window.location.host
      const uri = window.location.origin
      const issuedAt = new Date().toISOString()

      // EIP-4361 SIWE message format with statement
      const message = `${domain} wants you to sign in with your Ethereum account:
${address}

${siweStatement(chainId)}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`

      console.log('🔧 ReownWalletConnect: SIWE message created manually', {
        domain,
        address,
        chainId,
        messageLength: message.length
      })

      // Step 3: Sign the message
      const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex')
      const signature = await this.withApprovalPrompt(() => walletProvider.request({
        method: 'personal_sign',
        params: [hexMessage, address]
      })) as string

      console.log('🔧 ReownWalletConnect: Message signed by wallet')

      // Step 4: Send to backend for verification
      const verifyResponse = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature
        })
      })

      if (!verifyResponse.ok) {
        console.error('🔧 ReownWalletConnect: Backend verification failed')
        return false
      }

      console.log('🔧 ReownWalletConnect: ✅ SIWX authentication successful!')
      return true

    } catch (error) {
      console.error('🔧 ReownWalletConnect: Error requesting authentication:', error)
      this.lastAuthFailure = classifyAuthError(error)
      reportAuthFailure(
        this.lastAuthFailure.kind,
        'request-authentication',
        this.lastAuthFailure.message
      )
      return false
    }
  }

  getProvider() {
    if (!this.appKit) {
      throw new Error('AppKit not initialized')
    }
    return this.appKit.getWalletProvider()
  }

  isConnected(): boolean {
    if (!this.appKit) return false
    const caipAddress = this.appKit.getCaipAddress()
    return !!caipAddress
  }

  getAddress(): string | null {
    if (!this.appKit) return null
    const caipAddress = this.appKit.getCaipAddress()
    if (!caipAddress) return null
    // Extract address from CAIP format (e.g., "eip155:8453:0x...")
    const parts = caipAddress.split(':')
    return parts[2] || null
  }

  /**
   * Subscribe to AppKit's account-changed events. Used by AuthManager to
   * react to AppKit's async session restore on cold load: when the user
   * refreshes the page, AppKit's persisted session is rehydrated after
   * AuthManager.restoreSession() has already finished its synchronous
   * pass, so we need a push-based hook to update state when that lands.
   */
  onConnectionChange(
    callback: (info: { isConnected: boolean; address: string | null }) => void
  ): () => void {
    if (!this.appKit || typeof this.appKit.subscribeAccount !== 'function') {
      return () => {}
    }

    let lastSeenConnected: boolean | null = null
    let lastSeenAddress: string | null = null

    const unsubscribe = this.appKit.subscribeAccount((accountState: any) => {
      // accountState shape from AppKit: { isConnected, address, caipAddress, ... }
      const isConnected = !!(accountState?.isConnected || accountState?.caipAddress)
      let address: string | null = null
      if (accountState?.address) {
        address = accountState.address
      } else if (accountState?.caipAddress) {
        const parts = String(accountState.caipAddress).split(':')
        address = parts[2] || null
      }

      // Dedup: AppKit can emit identical states; only forward real changes.
      if (isConnected === lastSeenConnected && address === lastSeenAddress) return
      lastSeenConnected = isConnected
      lastSeenAddress = address

      try {
        callback({ isConnected, address })
      } catch (err) {
        console.warn('🔧 ReownWalletConnect: onConnectionChange callback threw', err)
      }
    })

    return typeof unsubscribe === 'function' ? unsubscribe : () => {}
  }

  /**
   * Create an EIP-1193 compatible provider for ethers
   * Includes a disconnect method for proper cleanup
   */
  createEIP1193Provider() {
    const walletProvider = this.getProvider()

    if (!walletProvider) {
      throw new Error('No wallet provider available')
    }

    console.log('🔧 ReownWalletConnect: Creating EIP-1193 provider from AppKit')

    // CRITICAL: Wrap provider with mobile deep link support BEFORE adding disconnect
    // This ensures all wallet interactions trigger deep links on mobile
    const mobileAwareProvider = wrapProviderWithMobileDeepLinks(walletProvider)

    // Wrap the mobile-aware provider with disconnect capability
    const provider = {
      ...mobileAwareProvider,
      request: mobileAwareProvider.request.bind(mobileAwareProvider),
      // Add disconnect method that cleans up the AppKit session
      disconnect: async () => {
        console.log('🔧 ReownWalletConnect: EIP-1193 provider disconnect called')
        await this.disconnect()
      },
      // Keep reference to original provider if needed
      _originalProvider: walletProvider,
      _reownInstance: this
    }

    return provider
  }

  /**
   * Generate signature-based auth token for backend authentication
   */
  /**
   * Get cached authentication token if available and valid
   */
  getCachedAuthToken(address: string): string | null {
    try {
      const cachedAuthKey = `walletconnect_auth_${address}`
      const cachedAuth = localStorage.getItem(cachedAuthKey)

      if (cachedAuth) {
        const authData = JSON.parse(cachedAuth)
        const authAge = Date.now() - authData.timestamp
        const isAuthValid = authAge < (24 * 60 * 60 * 1000) // 24 hours

        if (isAuthValid && authData.walletAddress === address) {
          console.log('🔧 ReownWalletConnect: Using cached auth token')
          return authData.authToken
        } else {
          localStorage.removeItem(cachedAuthKey)
        }
      }
    } catch (e) {
      console.warn('🔧 ReownWalletConnect: Failed to get cached auth token:', e)
    }
    return null
  }

  /**
   * Attempt to batch connect and sign operations in a single user interaction
   * Falls back to sequential operations if batching isn't supported
   */
  async connectAndAuthenticate(): Promise<{ success: boolean; authToken?: string; user?: any; provider?: any; error?: string }> {
    // Prevent race conditions - if already connecting, wait for current attempt
    if (this.isConnecting) {
      console.log('🔧 ReownWalletConnect: Connection already in progress, waiting...')
      return { success: false, error: 'Connection already in progress' }
    }

    this.isConnecting = true

    try {
      console.log('🔧 ReownWalletConnect: Attempting batched connect + authenticate...')

      if (!this.appKit) {
        await this.initialize()
      }

      // Check if already connected and try to reuse cached auth AFTER initialization
      if (this.isConnected()) {
        console.log('🔧 ReownWalletConnect: Already connected after initialization, checking for cached auth...')
        const address = this.getAddress()
        const provider = this.getProvider()

        if (address) {
          // Check for cached auth token first
          const cachedToken = this.getCachedAuthToken(address)
          if (cachedToken) {
            console.log('🔧 ReownWalletConnect: Found cached auth token, returning...')
            return {
              success: true,
              authToken: cachedToken,
              user: { walletAddress: address },
              provider: provider
            }
          }

          // No cached token, continue with authentication (skip connection)
          console.log('🔧 ReownWalletConnect: No cached auth, proceeding with signature request...')
        }
      }

      // If not already connected, establish connection first
      let provider: any
      let address: string

      if (this.isConnected()) {
        // Already connected, get existing connection details
        provider = this.getProvider()
        const connectedAddress = this.getAddress()
        if (!provider || !connectedAddress) {
          throw new Error('Connected but missing provider or address')
        }
        address = connectedAddress
      } else {
        // Need to connect first
        const connectionResult = await this.connect()
        if (!connectionResult.success) {
          return connectionResult
        }

        provider = this.getProvider()
        if (!provider) {
          throw new Error('No provider available after connection')
        }

        const ethersProvider = new ethers.BrowserProvider(provider)
        const signer = await ethersProvider.getSigner()
        address = await signer.getAddress()

        // Check for cached auth token again after connection
        const cachedToken = this.getCachedAuthToken(address)
        if (cachedToken) {
          return {
            success: true,
            authToken: cachedToken,
            user: { walletAddress: address },
            provider: provider
          }
        }
      }

      // Create message to sign
      const timestamp = Date.now()
      const nonce = Math.random().toString(36).substring(2, 15)
      const message = buildAuthTokenMessage({ address, timestamp, nonce })

      console.log('🔧 ReownWalletConnect: Testing batched request support...')

      // Try batched requests first - this might work with some WalletConnect implementations
      try {
        const requests = [
          { method: 'eth_accounts' },
          { method: 'personal_sign', params: [message, address] }
        ]

        // Test if wallet supports batching
        const batchResult = await provider.request({
          method: 'wallet_batch',
          params: requests
        })

        console.log('🔧 ReownWalletConnect: ✅ Batched request succeeded!', batchResult)

        if (batchResult && batchResult[1]) {
          const signature = batchResult[1]
          return this.buildAuthTokenResponse(address, message, signature, timestamp, nonce, provider)
        }
      } catch (batchError) {
        console.log('🔧 ReownWalletConnect: Batched requests not supported, falling back to sequential:', batchError instanceof Error ? batchError.message : String(batchError))
      }

      // Alternative: Try eth_sendRawTransaction with multiple operations
      try {
        // Some wallets support queuing multiple operations
        console.log('🔧 ReownWalletConnect: Trying alternative batch method...')

        const multiRequest = await provider.request({
          method: 'wallet_requestPermissions',
          params: [
            {
              eth_accounts: {},
              personal_sign: {
                message: message,
                address: address
              }
            }
          ]
        })

        console.log('🔧 ReownWalletConnect: Multi-request result:', multiRequest)
      } catch (multiError) {
        console.log('🔧 ReownWalletConnect: Multi-request not supported:', multiError instanceof Error ? multiError.message : String(multiError))
      }

      // Fall back to individual signing
      console.log('🔧 ReownWalletConnect: Falling back to individual signature request...')
      const authToken = await this.generateSignatureAuthToken()
      return {
        success: true,
        authToken,
        user: { walletAddress: address },
        provider: provider
      }

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Batched connect + auth failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      this.isConnecting = false
    }
  }

  private buildAuthTokenResponse(address: string, message: string, signature: string, timestamp: number, nonce: string, provider: any) {
    const authToken = btoa(JSON.stringify({
      type: 'signature_auth',
      walletAddress: address,
      message,
      signature,
      timestamp,
      nonce,
      issuer: 'reown_walletconnect',
      header: { alg: 'ECDSA', typ: 'SIG' },
      payload: {
        sub: address,
        iat: Math.floor(timestamp / 1000),
        iss: 'reown_walletconnect',
        wallet_type: 'walletconnect'
      }
    }))

    // Cache the authentication
    const cachedAuthKey = `walletconnect_auth_${address}`
    const authCache = { timestamp, walletAddress: address, authToken }
    localStorage.setItem(cachedAuthKey, JSON.stringify(authCache))

    return {
      success: true,
      authToken,
      user: { walletAddress: address },
      provider: provider
    }
  }

  async generateSignatureAuthToken(): Promise<string> {
    try {
      const provider = this.getProvider()
      if (!provider) {
        throw new Error('No provider available')
      }

      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      const address = await signer.getAddress()

      // Check for cached auth token first
      const cachedToken = this.getCachedAuthToken(address)
      if (cachedToken) {
        return cachedToken
      }

      // Create message to sign
      const timestamp = Date.now()
      const nonce = Math.random().toString(36).substring(2, 15)
      const message = buildAuthTokenMessage({ address, timestamp, nonce })

      console.log('🔧 ReownWalletConnect: Signing auth message:', message)

      // If this is a desktop-to-mobile QR session, show the mobile prompt
      if (this.isDesktopQRSession && this.onMobileActionRequired) {
        console.log('🔧 ReownWalletConnect: Desktop QR session detected, showing mobile prompt')
        this.onMobileActionRequired('sign')
      }

      // Ensure provider is fully ready by making a test request first
      // This helps establish the WalletConnect relay connection properly
      try {
        console.log('🔧 ReownWalletConnect: Ensuring provider is ready...')
        await provider.request({ method: 'eth_accounts' })

        // Small delay to ensure WalletConnect relay is fully established
        // This helps with the issue where signature request doesn't reach mobile wallet immediately
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (e) {
        console.warn('🔧 ReownWalletConnect: Provider readiness check failed:', e)
      }

      console.log('🔧 ReownWalletConnect: Requesting signature from wallet...')
      const signature = await this.withApprovalPrompt(() => signer.signMessage(message))

      // Create auth token
      const authToken = btoa(JSON.stringify({
        type: 'signature_auth',
        walletAddress: address,
        message,
        signature,
        timestamp,
        nonce,
        issuer: 'reown_walletconnect',
        header: { alg: 'ECDSA', typ: 'SIG' },
        payload: { 
          sub: address, 
          iat: Math.floor(timestamp / 1000),
          iss: 'reown_walletconnect',
          wallet_type: 'walletconnect'
        }
      }))

      console.log('🔧 ReownWalletConnect: ✅ Signature auth token generated')

      // Cache the authentication for this address to avoid repeated signing
      const cachedAuthKey = `walletconnect_auth_${address}`
      const authCache = {
        timestamp: Date.now(),
        walletAddress: address,
        authToken: authToken
      }
      localStorage.setItem(cachedAuthKey, JSON.stringify(authCache))
      console.log('🔧 ReownWalletConnect: Authentication cached for 24 hours')

      return authToken

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Failed to generate auth token:', error)
      throw error
    }
  }

  /**
   * Get human-readable network name from chain ID
   */
  private getNetworkName(chainId: number): string {
    const networkNames: Record<number, string> = {
      1: 'Ethereum Mainnet',
      8453: 'Base Mainnet',
      11155111: 'Sepolia Testnet',
      84532: 'Base Sepolia Testnet'
    }
    return networkNames[chainId] || `Chain ${chainId}`
  }
}