import UniversalProvider from '@walletconnect/universal-provider';
import { WalletConnectModal } from '@walletconnect/modal';
// Simple WalletConnect v2 utility - not a full auth provider
import { ethers } from 'ethers';
import { BackendAuth } from './backendAuth';

export class WalletConnectV2Provider {
  private provider: UniversalProvider | null = null;
  private modal: WalletConnectModal | null = null;
  private backendAuth: BackendAuth;
  private projectId: string;
  private chainId: number;
  private rpcUrl: string;

  constructor(config: any) {
    this.backendAuth = new BackendAuth();
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.projectId = config.walletConnectProjectId || '';
    
    if (!this.projectId || this.projectId === 'your_project_id_here') {
      console.warn('WalletConnect Project ID not configured. Please set WALLETCONNECT_PROJECT_ID in your environment.');
    }
  }

  async connect(): Promise<{ user: any; provider: ethers.BrowserProvider | null }> {
    try {
      // Only clean up if we have a provider instance
      if (this.provider) {
        console.log('WalletConnect: Cleaning up existing provider...');
        await this.cleanup();
      }

      // Initialize Universal Provider
      console.log('WalletConnect: Initializing Universal Provider...');
      this.provider = await UniversalProvider.init({
        projectId: this.projectId,
        metadata: {
          name: 'Conduit UCPI',
          description: 'Instant Escrow - Secure payment gateway',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://conduit-ucpi.com',
          icons: ['https://conduit-ucpi.com/logo.png']
        }
      });

      // Initialize modal for QR code display
      if (!this.modal && typeof window !== 'undefined') {
        this.modal = new WalletConnectModal({
          projectId: this.projectId,
          chains: [`eip155:${this.chainId}`],
          themeMode: 'light',
          themeVariables: {
            '--wcm-z-index': '99999',
          }
        });
      }

      // Check if already connected and validate the session
      if (this.provider.session) {
        console.log('WalletConnect: Found existing session, validating...');
        try {
          // Test if the session is actually valid by making a simple request
          await this.provider.request({
            method: 'eth_accounts',
            params: []
          });
          console.log('WalletConnect: Existing session is valid, using it');
          return await this.createUserFromSession();
        } catch (error) {
          console.warn('WalletConnect: Existing session is invalid, clearing and creating new connection:', error);
          // Clear the invalid session
          this.provider.session = undefined;
          await this.provider.disconnect().catch(() => {}); // Ignore disconnect errors
        }
      }

      // Request connection
      const namespaces = {
        eip155: {
          methods: [
            'eth_sendTransaction',
            'eth_signTransaction',
            'eth_sign',
            'personal_sign',
            'eth_signTypedData',
          ],
          chains: [`eip155:${this.chainId}`],
          events: ['chainChanged', 'accountsChanged'],
          rpcMap: {
            [this.chainId]: this.rpcUrl
          }
        }
      };

      console.log('WalletConnect: Initiating connection...');
      
      // Connect with modal
      const { uri, approval } = await this.provider.client.connect({
        requiredNamespaces: namespaces
      });

      // Open modal with the URI
      if (uri && this.modal) {
        console.log('WalletConnect: Opening modal with URI');
        await this.modal.openModal({ uri });
      }

      // Wait for session approval with timeout
      console.log('WalletConnect: Waiting for session approval...');
      const session = await Promise.race([
        approval(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('WalletConnect session approval timeout')), 60000)
        )
      ]);
      
      console.log('WalletConnect: Session approved', session);
      
      // Close modal
      if (this.modal) {
        this.modal.closeModal();
      }

      // Give the provider a moment to update its session property
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify session was established - check both session object and provider.session
      if (!session || !(session as any).topic) {
        throw new Error('WalletConnect session approval failed - no valid session returned');
      }

      // If provider.session is not yet available, we need to wait for it to be set
      if (!this.provider.session) {
        console.log('WalletConnect: Provider session not yet available, checking provider client...');
        
        // The session should be available through the provider's client
        if (this.provider.client && session) {
          console.log('WalletConnect: Setting up provider with approved session...');
          
          // Force the provider to use the approved session
          // The provider should pick up the session from its client
          const sessionWithTopic = session as any;
          await this.provider.client.session.set(sessionWithTopic.topic, sessionWithTopic);
          
          // Give the provider time to update
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if session is now available
          if (!this.provider.session) {
            // As a last resort, try to get the session from the client
            const sessions = this.provider.client.session.getAll();
            if (sessions && sessions.length > 0) {
              (this.provider as any).session = sessions[0];
              console.log('WalletConnect: Manually set session from client sessions');
            } else {
              throw new Error('WalletConnect session could not be established');
            }
          }
        } else {
          throw new Error('WalletConnect provider client not initialized');
        }
      }

      return await this.createUserFromSession();
    } catch (error) {
      console.error('WalletConnect connection failed:', error);
      // Clean up on error
      await this.cleanup();
      throw error;
    }
  }

  private async createUserFromSession(): Promise<{ user: any; provider: ethers.BrowserProvider | null }> {
    if (!this.provider?.session) {
      throw new Error('No active WalletConnect session');
    }

    try {
      console.log('WalletConnect: Session details:', {
        topic: this.provider.session.topic,
        expiry: this.provider.session.expiry,
        namespaces: Object.keys(this.provider.session.namespaces || {})
      });

      // First, let's get the accounts directly from the session to ensure it's active
      const accounts = this.provider.session.namespaces?.eip155?.accounts || [];
      if (accounts.length === 0) {
        throw new Error('No accounts found in WalletConnect session');
      }

      // Extract the wallet address from the account string (format: "eip155:chainId:address")
      const walletAddress = accounts[0].split(':')[2];
      console.log('WalletConnect: Wallet address from session:', walletAddress);

      // Keep the raw provider for SDK compatibility
      console.log('WalletConnect: Using raw provider for SDK compatibility...');

      // Instead of using getSigner() which might trigger network detection,
      // let's use the wallet address directly from the session
      console.log('WalletConnect: Using address from session for authentication');
      
      // Create a minimal signer interface for signing messages
      // We'll request the signature through WalletConnect directly
      const message = `Sign this message to authenticate with Conduit UCPI\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      console.log('WalletConnect: Requesting signature for authentication...');

      try {
        // First verify the provider is still connected
        if (!this.provider.session) {
          throw new Error('Session no longer exists');
        }

        // Check if provider.client is available for direct requests
        let signature: string;
        if (this.provider.client && this.provider.client.request) {
          console.log('WalletConnect: Using client.request for signature...');
          // Use the client's request method directly
          signature = await this.provider.client.request({
            topic: this.provider.session.topic,
            chainId: `eip155:${this.chainId}`,
            request: {
              method: 'personal_sign',
              params: [
                ethers.hexlify(ethers.toUtf8Bytes(message)),
                walletAddress
              ]
            }
          }) as string;
        } else if (this.provider.request) {
          console.log('WalletConnect: Using provider.request for signature...');
          // Fallback to provider.request
          signature = await this.provider.request({
            method: 'personal_sign',
            params: [
              ethers.hexlify(ethers.toUtf8Bytes(message)),
              walletAddress
            ]
          }) as string;
        } else {
          throw new Error('No request method available on provider');
        }

        console.log('WalletConnect: Signature received');
        
        // Create a signature-based auth token compatible with backend expectations
        // Use the same format as Web3Auth external wallet authentication
        const timestamp = Date.now();
        const authToken = btoa(JSON.stringify({
          type: 'signature_auth',
          walletAddress,
          message,
          signature,
          timestamp,
          nonce: 'walletconnect_v2',
          issuer: 'walletconnect_v2',
          // Add a simple header/payload structure for compatibility
          header: { alg: 'ECDSA', typ: 'SIG' },
          payload: { 
            sub: walletAddress, 
            iat: Math.floor(timestamp / 1000),
            iss: 'walletconnect_v2',
            wallet_type: 'walletconnect'
          }
        }));
        
        console.log('WalletConnect: Created signature token for backend authentication');
        const { user } = await this.backendAuth.login(authToken, walletAddress);
        
        // Add required fields for compatibility
        const enrichedUser = {
          ...user,
          walletAddress: walletAddress,
          idToken: authToken, // Use the full signature token
          authProvider: 'walletconnect'
        };
        
        console.log('WalletConnect: Authentication successful');
        // Return the properly wrapped ethers provider
        return { user: enrichedUser, provider: this.getEthersProvider() };
      } catch (signError) {
        console.error('WalletConnect: Signature request failed, trying with signer:', signError);
        
        // Fallback to ethers signer method
        const ethersProvider = new ethers.BrowserProvider(this.provider as any);
        const signer = await ethersProvider.getSigner();
        const signerAddress = await signer.getAddress();
        console.log('WalletConnect: Fallback - Signer address:', signerAddress);
        
        const signature = await signer.signMessage(message);
        
        // Create a signature-based auth token compatible with backend expectations
        const timestamp = Date.now();
        const authToken = btoa(JSON.stringify({
          type: 'signature_auth',
          walletAddress: signerAddress,
          message,
          signature,
          timestamp,
          nonce: 'walletconnect_v2_fallback',
          issuer: 'walletconnect_v2',
          // Add a simple header/payload structure for compatibility
          header: { alg: 'ECDSA', typ: 'SIG' },
          payload: { 
            sub: signerAddress, 
            iat: Math.floor(timestamp / 1000),
            iss: 'walletconnect_v2',
            wallet_type: 'walletconnect'
          }
        }));
        
        const { user } = await this.backendAuth.login(authToken, signerAddress);
        
        const enrichedUser = {
          ...user,
          walletAddress: signerAddress,
          idToken: authToken,
          authProvider: 'walletconnect'
        };
        
        return { user: enrichedUser, provider: this.getEthersProvider() };
      }
    } catch (error) {
      console.error('WalletConnect: Failed to create user from session:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.modal) {
        this.modal.closeModal();
      }
      if (this.provider) {
        // Clear any existing session first
        if (this.provider.session) {
          try {
            await this.provider.disconnect();
          } catch (disconnectError) {
            console.warn('WalletConnect: Error during disconnect, forcing cleanup:', disconnectError);
            // Force clear the session if disconnect fails
            this.provider.session = undefined;
          }
        }
        // Clear any pending proposals or connections
        if (this.provider.client) {
          try {
            const pendingProposals = this.provider.client.proposal.getAll();
            for (const proposal of pendingProposals) {
              try {
                await this.provider.client.proposal.delete(proposal.id, {
                  code: 5100,
                  message: 'User rejected connection'
                });
              } catch (e) {
                // Ignore proposal deletion errors
              }
            }
          } catch (e) {
            // Ignore if proposal methods don't exist
          }
        }
      }
    } catch (error) {
      console.error('WalletConnect cleanup error:', error);
    } finally {
      this.provider = null;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.provider?.session) {
        await this.provider.disconnect();
      }
      await this.backendAuth.logout();
    } catch (error) {
      console.error('WalletConnect disconnect error:', error);
    } finally {
      await this.cleanup();
    }
  }

  async getUser(): Promise<any> {
    return null; // User data handled elsewhere
  }

  isConnected(): boolean {
    return !!this.provider?.session;
  }

  async switchChain(chainId: number): Promise<void> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // Chain not added to wallet, try to add it
      if (error.code === 4902) {
        await this.provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${chainId.toString(16)}`,
            chainName: chainId === 8453 ? 'Base' : 'Base Sepolia',
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: [this.rpcUrl],
            blockExplorerUrls: ['https://basescan.org'] // Default to Base explorer
          }]
        });
      } else {
        throw error;
      }
    }
  }

  async getProvider(): Promise<ethers.BrowserProvider | null> {
    if (!this.provider?.session) return null;
    return new ethers.BrowserProvider(this.provider as any);
  }

  getEthersProvider(): any {
    if (!this.provider?.session) {
      console.warn('WalletConnect: getEthersProvider called but no session available');
      return null;
    }
    
    console.log('WalletConnect: Creating JsonRpcProvider for reliable network operations...');
    console.log('WalletConnect: Using RPC URL:', this.rpcUrl);
    
    // For WalletConnect, we'll use a JsonRpcProvider for all read operations
    // This avoids the complexity of getting WalletConnect's provider to work with ethers
    // The WalletConnect provider will still be used for signing transactions when needed
    const jsonRpcProvider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    console.log('WalletConnect: Created reliable JsonRpcProvider for network calls');
    return jsonRpcProvider;
  }
}