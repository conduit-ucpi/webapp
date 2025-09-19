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
      // Clean up any existing session first to allow re-launch
      await this.disconnect();

      // Initialize Universal Provider
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

      // Check if already connected
      if (this.provider.session) {
        console.log('WalletConnect: Using existing session');
        return await this.createUserFromSession();
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

      // Verify session was established
      if (!this.provider.session) {
        throw new Error('WalletConnect session not established after approval');
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
      // First, let's get the accounts directly from the session to ensure it's active
      const accounts = this.provider.session.namespaces?.eip155?.accounts || [];
      if (accounts.length === 0) {
        throw new Error('No accounts found in WalletConnect session');
      }

      // Extract the wallet address from the account string (format: "eip155:chainId:address")
      const walletAddress = accounts[0].split(':')[2];
      console.log('WalletConnect: Wallet address from session:', walletAddress);

      // Create ethers provider with the connected provider
      const ethersProvider = new ethers.BrowserProvider(this.provider as any);

      // Test the connection by getting the signer 
      console.log('WalletConnect: Getting signer...');
      const signer = await ethersProvider.getSigner();
      
      // Verify the address matches
      const signerAddress = await signer.getAddress();
      console.log('WalletConnect: Signer address:', signerAddress);
      
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn('WalletConnect: Address mismatch, using signer address');
      }

      // Authenticate with backend
      const message = `Sign this message to authenticate with Conduit UCPI\n\nWallet: ${signerAddress}\nTimestamp: ${Date.now()}`;
      console.log('WalletConnect: Requesting signature for authentication...');
      const signature = await signer.signMessage(message);
      
      // Create a simple auth token for WalletConnect
      const authToken = `wc2_${signature.slice(0, 32)}`;
      const { user } = await this.backendAuth.login(authToken, signerAddress);
      
      // Add required fields for compatibility
      const enrichedUser = {
        ...user,
        walletAddress: signerAddress,
        idToken: `wc2_${signature.slice(0, 32)}`, // Create a unique token
        authProvider: 'walletconnect'
      };
      
      console.log('WalletConnect: Authentication successful');
      return { user: enrichedUser, provider: ethersProvider };
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
      if (this.provider?.session) {
        await this.provider.disconnect();
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
    if (!this.provider) return null;
    return new ethers.BrowserProvider(this.provider as any);
  }
}