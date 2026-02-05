/**
 * Test suite for ConnectWalletEmbedded config loading error
 *
 * Bug: When connect() returns undefined (due to config loading failure or unexpected error),
 * accessing connectionResult.success crashes with:
 * "Cannot read properties of undefined (reading 'success')"
 *
 * Root cause: No null/undefined check before accessing connectionResult.success
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { mLog } from '@/utils/mobileLogger';

// Mock the auth hook
const mockConnect = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    connect: mockConnect,
    isConnected: false,
    address: null,
  })),
}));

// Spy on mLog to track errors
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ConnectWalletEmbedded - Config Loading Error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle undefined connectionResult gracefully without runtime error', async () => {
    // GIVEN: connect() returns undefined (simulating config loading failure or unexpected error)
    mockConnect.mockResolvedValue(undefined);

    // WHEN: User clicks the button and connect returns undefined
    const { getByText } = render(<ConnectWalletEmbedded />);

    const button = getByText('Get Started');
    button.click();

    // Wait for async operations
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    // THEN: Should NOT have a runtime error about undefined.success
    await waitFor(() => {
      const errorCalls = (mLog.error as jest.Mock).mock.calls;

      // Check if we got the runtime error (THIS IS THE BUG)
      const hasRuntimeError = errorCalls.some(
        (call) => {
          const errorMsg = call[2]?.error || '';
          return errorMsg.includes("Cannot read properties of undefined (reading 'success')");
        }
      );

      // This assertion WILL FAIL because the code currently has the bug
      // After we fix it, this should pass
      expect(hasRuntimeError).toBe(false); // We DON'T want runtime errors
    });

    // Should instead log a helpful error message about connection failure
    await waitFor(() => {
      const errorCalls = (mLog.error as jest.Mock).mock.calls;

      const hasHelpfulError = errorCalls.some(
        (call) => {
          return call[1] === 'Wallet connection failed' ||
                 call[1] === 'No connection result returned';
        }
      );

      // After fix, we should get a helpful error message instead of a crash
      expect(hasHelpfulError).toBe(true);
    });
  });

  it('should handle null connectionResult without crashing', async () => {
    // GIVEN: connect() returns null (another edge case)
    mockConnect.mockResolvedValue(null);

    // WHEN: User clicks the button
    const { getByText } = render(<ConnectWalletEmbedded />);

    const button = getByText('Get Started');
    button.click();

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    // THEN: Should NOT crash
    await waitFor(() => {
      expect(getByText('Get Started')).toBeInTheDocument();
    });
  });

  it('should handle connectionResult without success property', async () => {
    // GIVEN: connect() returns an object but without the expected properties
    mockConnect.mockResolvedValue({} as any);

    // WHEN: User clicks the button
    const { getByText } = render(<ConnectWalletEmbedded />);

    const button = getByText('Get Started');
    button.click();

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    // THEN: Should NOT crash - should treat as failed connection
    await waitFor(() => {
      expect(getByText('Get Started')).toBeInTheDocument();
    });
  });

  it('should handle connect() throwing an exception', async () => {
    // GIVEN: connect() throws an error
    mockConnect.mockRejectedValue(new Error('Config not loaded'));

    // WHEN: User clicks the button
    const { getByText } = render(<ConnectWalletEmbedded />);

    const button = getByText('Get Started');
    button.click();

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    // THEN: Should NOT crash - should log error
    await waitFor(() => {
      expect(getByText('Get Started')).toBeInTheDocument();
    });

    // Should have logged the error
    const errorCalls = (mLog.error as jest.Mock).mock.calls;
    expect(errorCalls.length).toBeGreaterThan(0);
  });
});
