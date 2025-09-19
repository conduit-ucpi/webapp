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
        const ethersProvider = new ethers.BrowserProvider(this.provider as any);
        const signer = await ethersProvider.getSigner();
        const walletAddress = await signer.getAddress();
        
        // Authenticate with backend
        const message = `Sign this message to authenticate with Conduit UCPI\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
        const signature = await signer.signMessage(message);
        
        // Create a simple auth token for WalletConnect
        const authToken = `wc2_${signature.slice(0, 32)}`;
        const { user } = await this.backendAuth.login(authToken, walletAddress);
        
        // Add required fields for compatibility
        const enrichedUser = {
          ...user,
          walletAddress,
          idToken: `wc2_${signature.slice(0, 32)}`, // Create a unique token
          authProvider: 'walletconnect'
        };
        
        return { user: enrichedUser, provider: ethersProvider };
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

      // Connect with modal
      const { uri, approval } = await this.provider.client.connect({
        requiredNamespaces: namespaces
      });

      // Open modal with the URI
      if (uri && this.modal) {
        await this.modal.openModal({ uri });
      }

      // Wait for session approval
      const session = await approval();
      
      // Close modal
      if (this.modal) {
        this.modal.closeModal();
      }

      // Create ethers provider
      const ethersProvider = new ethers.BrowserProvider(this.provider as any);
      const signer = await ethersProvider.getSigner();
      const walletAddress = await signer.getAddress();
      
      // Authenticate with backend
      const message = `Sign this message to authenticate with Conduit UCPI\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      
      // Create a simple auth token for WalletConnect
      const authToken = `wc2_${signature.slice(0, 32)}`;
      const { user } = await this.backendAuth.login(authToken, walletAddress);
      
      // Add required fields for compatibility
      const enrichedUser = {
        ...user,
        walletAddress,
        idToken: `wc2_${signature.slice(0, 32)}`, // Create a unique token
        authProvider: 'walletconnect'
      };
      
      return { user: enrichedUser, provider: ethersProvider };
    } catch (error) {
      console.error('WalletConnect connection failed:', error);
      if (this.modal) {
        this.modal.closeModal();
      }
      throw error;
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
      this.provider = null;
      if (this.modal) {
        this.modal.closeModal();
      }
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