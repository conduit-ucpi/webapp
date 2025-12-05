/**
 * Provider registry for managing available auth providers
 */

import { AuthConfig, ProviderType } from '../types';
import { UnifiedProvider } from '../types/unified-provider';
import { mLog } from '../../../utils/mobileLogger';

export class ProviderRegistry {
  private providers: Map<ProviderType, UnifiedProvider> = new Map();
  private initialized = false;

  async initialize(config: AuthConfig): Promise<void> {
    if (this.initialized) {
      mLog.debug('ProviderRegistry', 'Already initialized, skipping');
      return;
    }

    mLog.info('ProviderRegistry', 'Initializing providers');

    const isInFarcaster = this.isInFarcaster();
    // Reduced environment detection logging

    try {
      // Detect environment and register appropriate providers
      if (isInFarcaster) {
        mLog.info('ProviderRegistry', 'Detected Farcaster environment, registering Farcaster provider');
        await this.registerFarcasterProvider(config);
      } else {
        // Register WalletConnect provider (handles ALL auth: social, email, wallets)
        if (config.walletConnectProjectId) {
          mLog.info('ProviderRegistry', 'WalletConnect project ID found, registering WalletConnect provider');
          await this.registerWalletConnectProvider(config);

          if (this.providers.has('walletconnect')) {
            mLog.info('ProviderRegistry', 'WalletConnect provider registered successfully');
          } else {
            throw new Error('WalletConnect provider registration failed');
          }
        } else {
          throw new Error('WalletConnect project ID is required');
        }
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

  getProvider(type: ProviderType): UnifiedProvider | null {
    return this.providers.get(type) || null;
  }

  getBestProvider(): UnifiedProvider | null {
    // Return the first available provider
    // Priority: farcaster (if in frame) -> walletconnect
    let bestProvider: UnifiedProvider | null = null;
    let selectedType: string = 'none';

    if (this.providers.has('farcaster')) {
      bestProvider = this.providers.get('farcaster')!;
      selectedType = 'farcaster';
    } else if (this.providers.has('walletconnect')) {
      bestProvider = this.providers.get('walletconnect')!;
      selectedType = 'walletconnect';
    }

    // Provider selection completed

    return bestProvider;
  }

  getAllProviders(): UnifiedProvider[] {
    return Array.from(this.providers.values());
  }

  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  private async registerDynamicProvider(config: AuthConfig): Promise<void> {
    mLog.info('ProviderRegistry', 'Registering Dynamic provider');

    // Dynamic import to avoid bundle size
    const { DynamicProvider } = await import('../providers/DynamicProvider');
    const provider = DynamicProvider.getInstance(config);
    await provider.initialize();
    this.providers.set('dynamic', provider);
    mLog.info('ProviderRegistry', 'Registered Dynamic provider successfully');
  }

  private async registerWalletConnectProvider(config: AuthConfig): Promise<void> {
    try {
      mLog.info('ProviderRegistry', 'Registering WalletConnect provider');
      // Dynamic import to avoid bundle size
      const { WalletConnectProvider } = await import('../providers/WalletConnectProvider');
      mLog.debug('ProviderRegistry', 'WalletConnectProvider imported successfully');

      const provider = new WalletConnectProvider(config);
      mLog.debug('ProviderRegistry', 'WalletConnectProvider instance created');

      await provider.initialize();
      mLog.debug('ProviderRegistry', 'WalletConnectProvider initialized');

      this.providers.set('walletconnect', provider);
      mLog.info('ProviderRegistry', 'Registered WalletConnect provider successfully');
    } catch (error) {
      mLog.error('ProviderRegistry', 'Failed to register WalletConnect provider', {
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