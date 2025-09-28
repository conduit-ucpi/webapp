import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, base, sepolia, baseSepolia } from '@reown/appkit/networks'
import { ethers } from 'ethers'
import { toHex } from '@/utils/hexUtils'
import { detectDevice } from '@/utils/deviceDetection'

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

      // Create AppKit instance  
      this.appKit = createAppKit({
        adapters: [ethersAdapter],
        networks: networks as [any, ...any[]], // Type assertion to fix tuple requirement
        projectId,
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
        const resolveOnce = (result: any) => {
          if (!isResolved) {
            isResolved = true
            resolve(result)
          }
        }

        const checkConnection = async () => {
          if (isResolved) return // Don't continue if already resolved

          try {
            // Check if we have an active connection by getting the account
            // The AppKit modal state is managed internally
            const caipAddress = this.appKit.getCaipAddress()

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

              // Ensure the provider is ready by testing it can get accounts
              try {
                const accounts = await walletProvider.request({ method: 'eth_accounts' })
                if (!accounts || accounts.length === 0) {
                  console.log('🔧 ReownWalletConnect: Provider not ready yet, retrying...')
                  setTimeout(checkConnection, 500)
                  return
                }
                console.log('🔧 ReownWalletConnect: Provider ready with accounts:', accounts)
              } catch (providerError) {
                console.log('🔧 ReownWalletConnect: Provider test failed, retrying...', providerError)
                setTimeout(checkConnection, 500)
                return
              }

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

              resolveOnce({
                success: true,
                user: { walletAddress: address },
                provider: walletProvider
              })
            } else {
              // Check again in 500ms
              setTimeout(checkConnection, 500)
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Waiting for connection...', error)
            setTimeout(checkConnection, 500)
          }
        }

        // Start checking
        checkConnection()

        // Timeout after 60 seconds (increased from 30)
        setTimeout(() => {
          resolveOnce({
            success: false,
            error: 'Connection timeout - user may have cancelled'
          })
        }, 60000)
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

    // Wrap the provider with disconnect capability
    const provider = {
      ...walletProvider,
      request: walletProvider.request.bind(walletProvider),
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