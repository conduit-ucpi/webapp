import { wrapProviderWithMobileDeepLinks } from '../../utils/mobileDeepLinkProvider';
import * as mobileDeepLinkProvider from '../../utils/mobileDeepLinkProvider';

// Mock device detection
jest.mock('../../utils/deviceDetection', () => ({
  detectDevice: jest.fn(() => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
  })),
}));

// Mock mobile logger
jest.mock('../../utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('wrapProviderWithMobileDeepLinks', () => {
  let capturedHref: string | null;
  let mockSetTimeout: jest.SpyInstance | undefined;
  let originalTriggerDeepLink: (url: string) => void;

  beforeAll(() => {
    // Save the original function
    originalTriggerDeepLink = mobileDeepLinkProvider.config.triggerDeepLink;
  });

  beforeEach(() => {
    capturedHref = null;

    // Replace config.triggerDeepLink with our mock that captures URLs
    mobileDeepLinkProvider.config.triggerDeepLink = (url: string) => {
      capturedHref = url;
    };

    // Mock setTimeout to execute immediately (no delay)
    mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as any;
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original function
    mobileDeepLinkProvider.config.triggerDeepLink = originalTriggerDeepLink;

    if (mockSetTimeout) {
      mockSetTimeout.mockRestore();
    }
  });

  describe('Layer 2: WalletConnect Session Detection', () => {
    it('should skip wrapper when provider has no WalletConnect session', async () => {
      // Mock provider without WalletConnect session (current failing scenario)
      const mockProvider = {
        request: jest.fn(),
        transport: {
          // Note: Based on v37.2.20 logs, transport exists but transport.provider is undefined
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should return the original provider unwrapped
      expect(wrappedProvider).toBe(mockProvider);
      expect(wrappedProvider.request).toBe(mockProvider.request);
    });

    it('should find WalletConnect session in direct provider', async () => {
      const mockSession = {
        peer: {
          metadata: {
            redirect: {
              native: 'metamask://',
              universal: 'https://metamask.app.link/',
            },
          },
        },
      };

      const originalRequest = jest.fn().mockResolvedValue('0xsignature');
      const mockProvider = {
        request: originalRequest,
        session: mockSession,
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should mutate the provider in place
      expect(wrappedProvider).toBe(mockProvider);
      // Request method should be replaced
      expect(wrappedProvider.request).not.toBe(originalRequest);

      // Call a user action method to trigger deep link
      await wrappedProvider.request({ method: 'personal_sign', params: ['0xdata', '0xaddress'] });

      // Should have triggered deep link
      expect(capturedHref).toBe('metamask://');
      // Should have called original request
      expect(originalRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: ['0xdata', '0xaddress'] });
    });

    it('should find WalletConnect session in provider.transport.provider', async () => {
      const mockSession = {
        peer: {
          metadata: {
            redirect: {
              native: 'metamask://',
              universal: 'https://metamask.app.link/',
            },
          },
        },
      };

      const mockWcProvider = {
        session: mockSession,
      };

      const originalRequest = jest.fn().mockResolvedValue('0xsignature');
      const mockProvider = {
        request: originalRequest,
        transport: {
          provider: mockWcProvider,
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should wrap the provider
      expect(wrappedProvider.request).not.toBe(originalRequest);

      // Call a user action method
      await wrappedProvider.request({ method: 'personal_sign', params: ['0xdata', '0xaddress'] });

      // Should have triggered deep link
      expect(capturedHref).toBe('metamask://');
      expect(originalRequest).toHaveBeenCalled();
    });

    it('should find WalletConnect session in provider.provider', async () => {
      const mockSession = {
        peer: {
          metadata: {
            redirect: {
              native: 'metamask://',
              universal: 'https://metamask.app.link/',
            },
          },
        },
      };

      const mockWcProvider = {
        session: mockSession,
      };

      const originalRequest = jest.fn().mockResolvedValue('0xsignature');
      const mockProvider = {
        request: originalRequest,
        provider: mockWcProvider,
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should wrap the provider
      expect(wrappedProvider.request).not.toBe(originalRequest);

      // Call a user action method
      await wrappedProvider.request({ method: 'eth_signTypedData_v4', params: ['0xaddress', '{}'] });

      // Should have triggered deep link
      expect(capturedHref).toBe('metamask://');
    });

    // TODO: Add test for actual Dynamic/viem provider structure once we get diagnostic logs from v37.2.21
    it.skip('should find WalletConnect session in actual Dynamic provider structure', async () => {
      // This test will be completed once we see the actual provider structure from diagnostic logs
      // The structure will be revealed by v37.2.21 inspection logs
    });
  });

  describe('Layer 3: Peer Metadata Verification', () => {
    it('should skip wrapper when session has no peer metadata', async () => {
      const mockProvider = {
        request: jest.fn(),
        session: {
          // Session exists but no peer metadata
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should return original provider
      expect(wrappedProvider).toBe(mockProvider);
    });
  });

  describe('Layer 4: Redirect URL Verification', () => {
    it('should skip wrapper when no redirect URLs available', async () => {
      const mockProvider = {
        request: jest.fn(),
        session: {
          peer: {
            metadata: {
              redirect: {
                // No native or universal URLs
              },
            },
          },
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should return original provider
      expect(wrappedProvider).toBe(mockProvider);
    });

    it('should use native redirect URL when available', async () => {
      const mockProvider = {
        request: jest.fn().mockResolvedValue('0xsignature'),
        session: {
          peer: {
            metadata: {
              redirect: {
                native: 'metamask://',
                universal: 'https://metamask.app.link/',
              },
            },
          },
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      await wrappedProvider.request({ method: 'personal_sign', params: [] });

      // Should prefer native over universal
      expect(capturedHref).toBe('metamask://');
    });

    it('should use universal redirect URL when native not available', async () => {
      const mockProvider = {
        request: jest.fn().mockResolvedValue('0xsignature'),
        session: {
          peer: {
            metadata: {
              redirect: {
                universal: 'https://metamask.app.link/',
              },
            },
          },
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      await wrappedProvider.request({ method: 'eth_sendTransaction', params: [] });

      // Should use universal when native not available
      expect(capturedHref).toBe('https://metamask.app.link/');
    });
  });

  describe('User Action Methods', () => {
    let mockProvider: any;
    let wrappedProvider: any;

    beforeEach(() => {
      mockProvider = {
        request: jest.fn().mockResolvedValue('0xsignature'),
        session: {
          peer: {
            metadata: {
              redirect: {
                native: 'metamask://',
              },
            },
          },
        },
      };

      wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);
    });

    it('should trigger deep link for personal_sign', async () => {
      await wrappedProvider.request({ method: 'personal_sign', params: [] });
      expect(capturedHref).toBe('metamask://');
    });

    it('should trigger deep link for eth_signTypedData_v4', async () => {
      await wrappedProvider.request({ method: 'eth_signTypedData_v4', params: [] });
      expect(capturedHref).toBe('metamask://');
    });

    it('should trigger deep link for eth_sendTransaction', async () => {
      await wrappedProvider.request({ method: 'eth_sendTransaction', params: [] });
      expect(capturedHref).toBe('metamask://');
    });

    it('should NOT trigger deep link for eth_accounts', async () => {
      await wrappedProvider.request({ method: 'eth_accounts', params: [] });
      expect(capturedHref).toBeNull();
    });

    it('should NOT trigger deep link for eth_chainId', async () => {
      await wrappedProvider.request({ method: 'eth_chainId', params: [] });
      expect(capturedHref).toBeNull();
    });
  });

  describe('Desktop Device', () => {
    beforeEach(() => {
      // Mock device detection to return desktop
      const deviceDetection = require('../../utils/deviceDetection');
      deviceDetection.detectDevice.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      });
    });

    it('should skip wrapper on desktop devices', () => {
      const mockProvider = {
        request: jest.fn(),
        session: {
          peer: {
            metadata: {
              redirect: { native: 'metamask://' },
            },
          },
        },
      };

      const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

      // Should return original provider unwrapped
      expect(wrappedProvider).toBe(mockProvider);
    });
  });
});
