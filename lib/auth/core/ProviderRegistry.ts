/**
 * Provider registry for managing available auth providers
 */

import { AuthProvider, AuthConfig, ProviderType } from '../types';

export class ProviderRegistry {
  private providers: Map<ProviderType, AuthProvider> = new Map();
  private initialized = false;

  async initialize(config: AuthConfig): Promise<void> {
    if (this.initialized) return;

    console.log('🔧 ProviderRegistry: Initializing providers');

    try {
      // Detect environment and register appropriate providers
      if (this.isInFarcaster()) {
        await this.registerFarcasterProvider(config);
      } else {
        await this.registerWeb3AuthProvider(config);
        // WalletConnect is integrated into Web3Auth Modal now
      }

      this.initialized = true;
      console.log('🔧 ProviderRegistry: ✅ Providers initialized');
    } catch (error) {
      console.error('🔧 ProviderRegistry: ❌ Provider initialization failed:', error);
      throw error;
    }
  }

  getProvider(type: ProviderType): AuthProvider | null {
    return this.providers.get(type) || null;
  }

  getBestProvider(): AuthProvider | null {
    // Return the first available provider
    // Priority: farcaster (if in frame) -> web3auth
    if (this.providers.has('farcaster')) {
      return this.providers.get('farcaster')!;
    }
    if (this.providers.has('web3auth')) {
      return this.providers.get('web3auth')!;
    }
    return null;
  }

  getAllProviders(): AuthProvider[] {
    return Array.from(this.providers.values());
  }

  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  private async registerWeb3AuthProvider(config: AuthConfig): Promise<void> {
    try {
      // Dynamic import to avoid bundle size in Farcaster frames
      const { Web3AuthProvider } = await import('../providers/Web3AuthProvider');
      const provider = new Web3AuthProvider(config);
      await provider.initialize();
      this.providers.set('web3auth', provider);
      console.log('🔧 ProviderRegistry: Registered Web3Auth provider');
    } catch (error) {
      console.warn('🔧 ProviderRegistry: Failed to register Web3Auth provider:', error);
    }
  }

  private async registerFarcasterProvider(config: AuthConfig): Promise<void> {
    try {
      // Dynamic import to avoid bundle size
      const { FarcasterProvider } = await import('../providers/FarcasterProvider');
      const provider = new FarcasterProvider(config);
      await provider.initialize();
      this.providers.set('farcaster', provider);
      console.log('🔧 ProviderRegistry: Registered Farcaster provider');
    } catch (error) {
      console.warn('🔧 ProviderRegistry: Failed to register Farcaster provider:', error);
    }
  }

  private isInFarcaster(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for Farcaster frame environment
    return !!(
      window.parent !== window &&
      (window.navigator.userAgent.includes('farcaster') ||
        window.location !== window.parent.location)
    );
  }
}