import { wrapProviderWithMobileDeepLinks } from '../../utils/mobileDeepLinkProvider';
import { mLog } from '../../utils/mobileLogger';

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

describe('Debug wrapper behavior', () => {
  let capturedHref: string | null;

  beforeEach(() => {
    capturedHref = null;

    // Mock window.location with setter
    delete (window as any).location;
    (window as any).location = {
      set href(value: string) {
        console.log('SETTER CALLED with:', value);
        capturedHref = value;
      },
      get href() {
        return capturedHref || 'http://localhost/';
      },
      toString: () => 'http://localhost/',
    };
  });

  it('should show which layer is failing', async () => {
    const originalRequest = jest.fn().mockResolvedValue('0xsignature');

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

    const mockProvider = {
      request: originalRequest,
      session: mockSession,
    };

    console.log('Before wrap - capturedHref:', capturedHref);
    console.log('Before wrap - window.location.href:', (window.location as any).href);

    const wrappedProvider = wrapProviderWithMobileDeepLinks(mockProvider);

    console.log('\n=== Wrapper logs ===');
    (mLog.info as jest.Mock).mock.calls.forEach((call: any, index: number) => {
      console.log(`${index + 1}. [${call[0]}] ${call[1]}`);
      if (call[2]) {
        console.log(`   Data:`, JSON.stringify(call[2], null, 2));
      }
    });

    console.log('\n=== Testing deep link ===');
    console.log('Provider mutated?', wrappedProvider === mockProvider);
    console.log('Request method replaced?', wrappedProvider.request !== originalRequest);
    console.log('Before request - capturedHref:', capturedHref);

    // Call a user action method
    console.log('Calling wrapped request...');
    await wrappedProvider.request({ method: 'personal_sign', params: [] });

    console.log('After request - capturedHref:', capturedHref);
    console.log('After request - window.location.href:', (window.location as any).href);
    console.log('Original request called?', originalRequest.mock.calls.length);
  });
});
