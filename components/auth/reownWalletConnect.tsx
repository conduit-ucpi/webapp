import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, base, sepolia, baseSepolia } from '@reown/appkit/networks'
import { ethers } from 'ethers'

export class ReownWalletConnectProvider {
  private appKit: any = null
  private provider: any = null
  private config: any

  constructor(config: any) {
    this.config = config
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
    try {
      console.log('🔧 ReownWalletConnect: Starting connection process...')

      if (!this.appKit) {
        await this.initialize()
      }

      // Check if already connected first
      const existingCaipAddress = this.appKit.getCaipAddress()
      if (existingCaipAddress) {
        console.log('🔧 ReownWalletConnect: Already connected, using existing connection')
        const parts = existingCaipAddress.split(':')
        const address = parts[2]
        const walletProvider = this.appKit.getWalletProvider()

        if (walletProvider) {
          // Test that the provider is working
          try {
            const accounts = await walletProvider.request({ method: 'eth_accounts' })
            if (accounts && accounts.length > 0) {
              console.log('🔧 ReownWalletConnect: Existing connection is ready')
              return {
                success: true,
                user: { walletAddress: address },
                provider: walletProvider
              }
            }
          } catch (error) {
            console.log('🔧 ReownWalletConnect: Existing connection not working, reconnecting...')
          }
        }
      }

      // Open the connection modal
      console.log('🔧 ReownWalletConnect: Opening connection modal...')
      await this.appKit.open()

      // Wait for connection to be established
      // AppKit manages the connection state internally
      return new Promise((resolve) => {
        const checkConnection = async () => {
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

              resolve({
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

        // Timeout after 30 seconds
        setTimeout(() => {
          const caipAddress = this.appKit.getCaipAddress()
          if (!caipAddress) {
            resolve({
              success: false,
              error: 'Connection timeout - user may have cancelled'
            })
          }
        }, 30000)
      })

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Connection failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      }
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
  async generateSignatureAuthToken(): Promise<string> {
    try {
      const provider = this.getProvider()
      if (!provider) {
        throw new Error('No provider available')
      }

      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      const address = await signer.getAddress()

      // Create message to sign
      const timestamp = Date.now()
      const nonce = Math.random().toString(36).substring(2, 15)
      const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`

      console.log('🔧 ReownWalletConnect: Signing auth message:', message)
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
      return authToken

    } catch (error) {
      console.error('🔧 ReownWalletConnect: ❌ Failed to generate auth token:', error)
      throw error
    }
  }
}