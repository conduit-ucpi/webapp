/**
 * Provider registry for managing available auth providers
 */

import { AuthProvider, AuthConfig, ProviderType } from '../types';
import { mLog } from '../../../utils/mobileLogger';

export class ProviderRegistry {
  private providers: Map<ProviderType, AuthProvider> = new Map();
  private initialized = false;

  async initialize(config: AuthConfig): Promise<void> {
    if (this.initialized) {
      mLog.debug('ProviderRegistry', 'Already initialized, skipping');
      return;
    }

    mLog.info('ProviderRegistry', 'Initializing providers');

    const isInFarcaster = this.isInFarcaster();
    mLog.debug('ProviderRegistry', 'Environment detection', {
      isInFarcaster,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      isInFrame: typeof window !== 'undefined' ? window.parent !== window : false
    });

    try {
      // Detect environment and register appropriate providers
      if (isInFarcaster) {
        mLog.info('ProviderRegistry', 'Detected Farcaster environment, registering Farcaster provider');
        await this.registerFarcasterProvider(config);
      } else {
        mLog.info('ProviderRegistry', 'Detected Web environment, registering Web3Auth provider');
        await this.registerWeb3AuthProvider(config);
        // WalletConnect is integrated into Web3Auth Modal now
      }

      this.initialized = true;
      mLog.info('ProviderRegistry', '✅ Providers initialized', {
        providerCount: this.providers.size,
        providerTypes: Array.from(this.providers.keys())
      });
    } catch (error) {
      mLog.error('ProviderRegistry', '❌ Provider initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  getProvider(type: ProviderType): AuthProvider | null {
    const provider = this.providers.get(type) || null;
    mLog.debug('ProviderRegistry', 'Getting provider', {
      requestedType: type,
      found: !!provider,
      availableTypes: Array.from(this.providers.keys())
    });
    return provider;
  }

  getBestProvider(): AuthProvider | null {
    // Return the first available provider
    // Priority: farcaster (if in frame) -> web3auth
    let bestProvider: AuthProvider | null = null;
    let selectedType: string = 'none';

    if (this.providers.has('farcaster')) {
      bestProvider = this.providers.get('farcaster')!;
      selectedType = 'farcaster';
    } else if (this.providers.has('web3auth')) {
      bestProvider = this.providers.get('web3auth')!;
      selectedType = 'web3auth';
    }

    mLog.debug('ProviderRegistry', 'Getting best provider', {
      selectedType,
      hasProvider: !!bestProvider,
      availableProviders: Array.from(this.providers.keys())
    });

    return bestProvider;
  }

  getAllProviders(): AuthProvider[] {
    const providers = Array.from(this.providers.values());
    mLog.debug('ProviderRegistry', 'Getting all providers', {
      count: providers.length,
      types: Array.from(this.providers.keys())
    });
    return providers;
  }

  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  private async registerWeb3AuthProvider(config: AuthConfig): Promise<void> {
    try {
      mLog.info('ProviderRegistry', 'Registering Web3Auth provider');
      // Dynamic import to avoid bundle size in Farcaster frames
      const { Web3AuthProvider } = await import('../providers/Web3AuthProvider');
      mLog.debug('ProviderRegistry', 'Web3AuthProvider imported successfully');

      const provider = new Web3AuthProvider(config);
      mLog.debug('ProviderRegistry', 'Web3AuthProvider instance created');

      await provider.initialize();
      mLog.debug('ProviderRegistry', 'Web3AuthProvider initialized');

      this.providers.set('web3auth', provider);
      mLog.info('ProviderRegistry', 'Registered Web3Auth provider successfully');
    } catch (error) {
      mLog.error('ProviderRegistry', 'Failed to register Web3Auth provider', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async registerFarcasterProvider(config: AuthConfig): Promise<void> {
    try {
      mLog.info('ProviderRegistry', 'Registering Farcaster provider');
      // Dynamic import to avoid bundle size
      const { FarcasterProvider } = await import('../providers/FarcasterProvider');
      mLog.debug('ProviderRegistry', 'FarcasterProvider imported successfully');

      const provider = new FarcasterProvider(config);
      mLog.debug('ProviderRegistry', 'FarcasterProvider instance created');

      await provider.initialize();
      mLog.debug('ProviderRegistry', 'FarcasterProvider initialized');

      this.providers.set('farcaster', provider);
      mLog.info('ProviderRegistry', 'Registered Farcaster provider successfully');
    } catch (error) {
      mLog.error('ProviderRegistry', 'Failed to register Farcaster provider', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
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