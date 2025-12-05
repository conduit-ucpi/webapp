import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, base, sepolia, baseSepolia } from '@reown/appkit/networks'
import { ethers } from 'ethers'
import { toHex } from '@/utils/hexUtils'
import { detectDevice } from '@/utils/deviceDetection'
import { wrapProviderWithMobileDeepLinks } from '@/utils/mobileDeepLinkProvider'
import { createAppKitSIWEConfig } from '@/lib/auth/siwe-config'

export class ReownWalletConnectProvider {
  private appKit: any = null
  private provider: any = null
  private config: any
  private isDesktopQRSession: boolean = false
  private onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void
  private isConnecting: boolean = false

  constructor(config: any, onMobileActionRequired?: (actionType: 'sign' | 'transaction') => void) {
    this.config = config
    this.onMobileActionRequired = onMobileActionRequired
  }

  async initialize() {
    try {
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

      // Create ethers adapter
      const ethersAdapter = new EthersAdapter()

      // Create SIWE config for one-click authentication
      const siweConfig = createAppKitSIWEConfig()
      console.log('🔧 ReownWalletConnect: SIWE config created - one-click auth enabled')

      // Create AppKit instance
      this.appKit = createAppKit({
        adapters: [ethersAdapter],
        networks: networks as [any, ...any[]], // Type assertion to fix tuple requirement
        projectId,
        siweConfig, // Enable SIWE for one-click authentication
        metadata: {
          name: 'Conduit UCPI',
          description: 'Time-delayed escrow contracts on Base',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://conduit-ucpi.com',
          icons: ['https://conduit-ucpi.com/favicon.ico']
        },
        features: {
          analytics: false // Disable analytics for privacy
        }
      })

      console.log('🔧 ReownWalletConnect: ✅ AppKit initialized successfully')
      return true

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Failed to initialize:', error)
      throw error
    }
  }

  async connect(): Promise<{ success: boolean; user?: any; provider?: any; error?: string }> {
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
                console.log('🔧 ReownWalletConnect: Existing connection is ready and on correct network')
                return {
                  success: true,
                  user: { walletAddress: address },
                  provider: walletProvider
                }
              } else {
                console.log('🔧 ReownWalletConnect: Existing connection on wrong network, will request switch in connection flow')
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

            // Clean up all listeners and intervals
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (isMobile) {
              window.removeEventListener('focus', handleFocus)
              if (mobilePollingInterval) {
                clearInterval(mobilePollingInterval)
              }
            }

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

        // Add visibility change listener to detect when user returns from wallet app
        // SOCIAL LOGIN FIX: Give WalletConnect plenty of time to process OAuth callbacks
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && !isResolved) {
            console.log('🔧 ReownWalletConnect: App became visible, giving WalletConnect time to process OAuth...')
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

        // Mobile-specific: Additional polling when WalletConnect modal is open
        // Will be started only after connection is initiated
        let mobilePollingInterval: any = null

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

              // Start mobile polling now that connection is initiated
              if (isMobile && !mobilePollingInterval) {
                console.log('🔧 ReownWalletConnect: Starting mobile polling after connection initiation...')
                mobilePollingInterval = setInterval(() => {
                  if (!isResolved) {
                    checkConnection()
                  } else if (mobilePollingInterval) {
                    clearInterval(mobilePollingInterval)
                  }
                }, 2000) // MOBILE FIX: Check every 2000ms to let WalletConnect sync naturally
              }
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

              // Verify the network is correct
              try {
                const currentChainId = await walletProvider.request({ method: 'eth_chainId' })
                const expectedChainId = this.config.chainId // Use chainId from config (decimal from ENV)
                const currentChainIdNum = typeof currentChainId === 'string'
                  ? (currentChainId.startsWith('0x') ? parseInt(currentChainId, 16) : parseInt(currentChainId, 10))
                  : currentChainId

                console.log('🔧 ReownWalletConnect: Network check - current:', currentChainIdNum, 'expected:', expectedChainId)

                if (currentChainIdNum !== expectedChainId) {
                  console.log('🔧 ReownWalletConnect: Wrong network, requesting switch to:', expectedChainId)
                  try {
                    // Convert decimal chainId to hex for the wallet_switchEthereumChain request
                    const expectedChainIdHex = toHex(expectedChainId)
                    console.log('🔧 ReownWalletConnect: Switching to network - decimal:', expectedChainId, 'hex:', expectedChainIdHex)

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
                      console.warn('🔧 ReownWalletConnect: Network switch failed - still on:', newChainIdNum)
                      // Continue anyway - some wallets don't support programmatic switching
                    } else {
                      console.log('🔧 ReownWalletConnect: ✅ Network switched successfully to:', newChainIdNum)
                    }
                  } catch (switchError) {
                    console.warn('🔧 ReownWalletConnect: Network switch failed:', switchError)
                    // Continue anyway - user might switch manually
                  }
                }
              } catch (chainError) {
                console.warn('🔧 ReownWalletConnect: Could not verify network:', chainError)
                // Continue anyway
              }

              // Close the modal before returning success so it doesn't stay open
              console.log('🔧 ReownWalletConnect: Closing modal after successful connection')
              await this.appKit.close()

              resolveOnce({
                success: true,
                user: { walletAddress: address },
                provider: walletProvider
              })
            } else {
              // MOBILE FIX: Slower polling to let WalletConnect sync naturally
              // Check again in 1000ms instead of 500ms to reduce interference
              setTimeout(checkConnection, 1000)
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Waiting for connection...', error)
            setTimeout(checkConnection, 1000)
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

                    // Start mobile polling now that connection is initiated
                    if (isMobile && !mobilePollingInterval) {
                      console.log('🔧 ReownWalletConnect: Starting mobile polling after wallet selection...')
                      mobilePollingInterval = setInterval(() => {
                        if (!isResolved) {
                          checkConnection()
                        } else if (mobilePollingInterval) {
                          clearInterval(mobilePollingInterval)
                        }
                      }, 2000) // MOBILE FIX: Check every 2000ms to let WalletConnect sync naturally
                    }
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

                  // Start mobile polling now that connection is initiated
                  if (isMobile && !mobilePollingInterval) {
                    console.log('🔧 ReownWalletConnect: Starting mobile polling after provider event...')
                    mobilePollingInterval = setInterval(() => {
                      if (!isResolved) {
                        checkConnection()
                      } else if (mobilePollingInterval) {
                        clearInterval(mobilePollingInterval)
                      }
                    }, 2000) // MOBILE FIX: Check every 2000ms to let WalletConnect sync naturally
                  }
                }
                checkConnection()
              }

              provider.on('connect', handleConnect)
              provider.on('session_event', handleConnect)
              provider.on('session_update', handleConnect)

              // Add cleanup function
              cleanupFunctions.push(() => {
                if (provider.off) {
                  provider.off('connect', handleConnect)
                  provider.off('session_event', handleConnect)
                  provider.off('session_update', handleConnect)
                }
              })
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Could not set up event subscriptions:', error)
          }
        }

        // Set up event subscriptions
        subscribeToEvents()

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
      const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`

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
      const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`

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
      const signature = await signer.signMessage(message)

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
}