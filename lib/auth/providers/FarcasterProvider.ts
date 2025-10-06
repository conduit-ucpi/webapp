/**
 * Farcaster provider implementation
 * Handles Farcaster frame authentication
 */

import { AuthProvider, AuthState, AuthConfig } from '../types';
import { TokenManager } from '../core/TokenManager';

export class FarcasterProvider implements AuthProvider {
  private config: AuthConfig;
  private tokenManager: TokenManager;
  private farcasterUser: any = null;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenManager = TokenManager.getInstance();
  }

  getProviderName(): string {
    return 'farcaster';
  }

  async initialize(): Promise<void> {
    console.log('🔧 FarcasterProvider: Initialize called');
    // Farcaster frames are initialized by the parent frame
  }

  async connect(): Promise<any> {
    console.log('🔧 FarcasterProvider: Connect called');

    try {
      // In Farcaster frames, we get user data from the frame context
      // This is a simplified implementation - actual Farcaster integration
      // would use the Farcaster SDK and frame protocols

      // For now, return a mock provider that works with the existing system
      const mockProvider = {
        request: async (args: { method: string; params?: any[] }) => {
          if (args.method === 'eth_accounts') {
            return ['0x1234567890123456789012345678901234567890']; // Mock address
          }
          throw new Error(`Method ${args.method} not supported in Farcaster frames`);
        }
      };

      // Store a mock token for Farcaster
      const authToken = `farcaster:${Date.now()}`;
      this.tokenManager.setToken(authToken);

      console.log('🔧 FarcasterProvider: ✅ Connected via Farcaster frame');
      return mockProvider;

    } catch (error) {
      console.error('🔧 FarcasterProvider: Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔧 FarcasterProvider: Disconnecting');
    this.farcasterUser = null;
    this.tokenManager.clearToken();
  }

  async switchWallet(): Promise<any> {
    // Farcaster frames don't support wallet switching as the user context
    // is provided by the parent frame
    throw new Error('Wallet switching is not supported in Farcaster frames');
  }

  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  async signMessage(message: string): Promise<string> {
    // In Farcaster frames, signing would be handled by the frame protocol
    throw new Error('Message signing not supported in Farcaster frames');
  }

  async getEthersProvider(): Promise<any> {
    // Farcaster frames typically don't provide direct ethers access
    return null;
  }

  hasVisitedBefore(): boolean {
    // In frames, we might not have localStorage access
    return true; // Assume users in frames have visited before
  }

  markAsVisited(): void {
    // No-op in frames
  }

  isReady: boolean = true;

  getState(): AuthState {
    return {
      user: this.farcasterUser,
      token: this.getToken(),
      isConnected: !!this.farcasterUser,
      isLoading: false,
      isInitialized: true,
      error: null,
      providerName: 'farcaster'
    };
  }

  isConnected(): boolean {
    return !!this.farcasterUser;
  }

  getUserInfo(): any {
    return this.farcasterUser;
  }
}