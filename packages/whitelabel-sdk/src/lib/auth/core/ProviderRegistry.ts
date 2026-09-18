/**
 * Provider registry: turns the manifest into live providers, and knows nothing about any of
 * them individually.
 *
 * ⚠️ NO PROVIDER IS NAMED IN THIS FILE, and that is the whole design. It used to hold an `if`
 *    per provider in `initialize()`, a `registerXProvider()` each, and a branch per provider in
 *    `getBestProvider()` — so adding one meant three edits here plus a union member plus the
 *    provider itself, and forgetting the `getBestProvider()` branch produced a provider that
 *    registered successfully and was never selected. Everything is `providerManifest.ts` now.
 */

import { AuthConfig, ProviderType } from '@/lib/auth/types';
import { UnifiedProvider } from '@/lib/auth/types/unified-provider';
import { mLog } from '@/utils/mobileLogger';
import { PROVIDERS, ProviderDescriptor } from './providerManifest';

export class ProviderRegistry {
  private providers: Map<ProviderType, UnifiedProvider> = new Map();
  private initialized = false;

  async initialize(config: AuthConfig): Promise<void> {
    if (this.initialized) {
      mLog.debug('ProviderRegistry', 'Already initialized, skipping');
      return;
    }

    assertDistinctPriorities();

    // Highest priority first, so the order things register in is the order they are preferred.
    const applicable = [...PROVIDERS]
      .filter((descriptor) => descriptor.applies(config))
      .sort((a, b) => b.priority - a.priority);

    mLog.info('ProviderRegistry', 'Initializing providers', {
      applicable: applicable.map((d) => d.type),
    });

    for (const descriptor of applicable) {
      await this.register(descriptor, config);
    }

    // ⚠️ A REQUIRED PROVIDER THAT APPLIED AND DID NOT START IS FATAL. Carrying on leaves
    //    somebody with no way to sign in at all, discovered at the first button press rather
    //    than at startup — and by then the failure is several screens from its cause.
    const missing = applicable.filter((d) => d.required && !this.providers.has(d.type));
    if (missing.length > 0) {
      throw new Error(
        `Required auth provider(s) failed to register: ${missing.map((d) => d.type).join(', ')}`
      );
    }

    if (this.providers.size === 0) {
      throw new Error(
        'No auth provider applies to this environment. Check walletConnectProjectId or privyAppId is set.'
      );
    }

    this.initialized = true;
    mLog.info('ProviderRegistry', '✅ Providers initialized', {
      providerCount: this.providers.size,
      providerTypes: Array.from(this.providers.keys()),
    });
  }

  /**
   * Load and start one provider.
   *
   * Failure is logged and swallowed here; whether it MATTERS is decided above, by `required`.
   * An optional provider that cannot start is an ordinary outcome — a frame SDK that is not
   * present, a network that is not reachable — and must not take the others down with it.
   */
  private async register(descriptor: ProviderDescriptor, config: AuthConfig): Promise<void> {
    try {
      mLog.info('ProviderRegistry', `Registering ${descriptor.type} provider`);
      const provider = await descriptor.load(config);
      await provider.initialize();
      this.providers.set(descriptor.type, provider);
      mLog.info('ProviderRegistry', `Registered ${descriptor.type} provider successfully`);
    } catch (error) {
      mLog.error('ProviderRegistry', `Failed to register ${descriptor.type} provider`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  getProvider(type: ProviderType): UnifiedProvider | null {
    return this.providers.get(type) || null;
  }

  /**
   * The provider to use, by manifest priority rather than by a chain of `if`s.
   *
   * ⚠️ THIS IS WHY PRIORITY IS DATA. The old version listed providers in an if/else here as
   *    well as in initialize(), so a new provider could register perfectly and still never be
   *    chosen — with nothing failing anywhere.
   */
  getBestProvider(): UnifiedProvider | null {
    const best = [...PROVIDERS]
      .filter((descriptor) => this.providers.has(descriptor.type))
      .sort((a, b) => b.priority - a.priority)[0];

    return best ? this.providers.get(best.type)! : null;
  }

  getAllProviders(): UnifiedProvider[] {
    return Array.from(this.providers.values());
  }

  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }
}

/**
 * Two providers claiming the same priority would be ordered by their position in the array,
 * which is invisible from the call site and changes when somebody tidies the list.
 */
function assertDistinctPriorities(): void {
  const seen = new Map<number, ProviderType>();
  for (const descriptor of PROVIDERS) {
    const clash = seen.get(descriptor.priority);
    if (clash) {
      throw new Error(
        `Auth providers '${clash}' and '${descriptor.type}' share priority ${descriptor.priority}. ` +
          'Priorities decide which provider is used and must be distinct.'
      );
    }
    seen.set(descriptor.priority, descriptor.type);
  }
}
