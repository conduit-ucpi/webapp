import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FarcasterLoggerProvider } from '@/components/debug/FarcasterLogger';
import { FarcasterDetectionProvider } from '@/components/farcaster/FarcasterDetectionProvider';
import { useFarcasterLogger } from '@/hooks/useFarcasterLogger';

// Mock the FarcasterDetectionProvider
jest.mock('@/components/farcaster/FarcasterDetectionProvider', () => ({
  FarcasterDetectionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="farcaster-provider">{children}</div>
  ),
  useFarcaster: () => ({
    isInFarcaster: true,
    isLoading: false,
    farcasterSDK: null,
  }),
}));

// Test component that uses the logging functions
const TestComponent = () => {
  const logger = useFarcasterLogger();

  const handleTestLog = () => {
    logger.log('Test log message');
    logger.warn('Test warning');
    logger.error('Test error');
    logger.info('Test info');
    logger.logContract('create', 'contract-123');
  };

  return (
    <button onClick={handleTestLog} data-testid="test-button">
      Test Logging
    </button>
  );
};

describe('FarcasterLogger', () => {
  it('provides logging functions through context', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <FarcasterDetectionProvider>
        <FarcasterLoggerProvider>
          <TestComponent />
        </FarcasterLoggerProvider>
      </FarcasterDetectionProvider>
    );

    const testButton = screen.getByTestId('test-button');
    fireEvent.click(testButton);

    // Verify console.log was called (the functions forward to console)
    expect(consoleSpy).toHaveBeenCalledWith('Test log message', undefined);
    
    consoleSpy.mockRestore();
  });

  it('renders without errors when used correctly', () => {
    expect(() => {
      render(
        <FarcasterDetectionProvider>
          <FarcasterLoggerProvider>
            <div>Test content</div>
          </FarcasterLoggerProvider>
        </FarcasterDetectionProvider>
      );
    }).not.toThrow();
  });

  it('allows access to logging functions via hook', () => {
    let loggerInstance: any;

    const TestHookComponent = () => {
      loggerInstance = useFarcasterLogger();
      return <div>Test</div>;
    };

    render(
      <FarcasterDetectionProvider>
        <FarcasterLoggerProvider>
          <TestHookComponent />
        </FarcasterLoggerProvider>
      </FarcasterDetectionProvider>
    );

    // Verify all logging functions are available
    expect(typeof loggerInstance.log).toBe('function');
    expect(typeof loggerInstance.warn).toBe('function');
    expect(typeof loggerInstance.error).toBe('function');
    expect(typeof loggerInstance.info).toBe('function');
    expect(typeof loggerInstance.debug).toBe('function');
    expect(typeof loggerInstance.logContract).toBe('function');
    expect(typeof loggerInstance.logAuth).toBe('function');
    expect(typeof loggerInstance.logWeb3).toBe('function');
    expect(typeof loggerInstance.logAPI).toBe('function');
    expect(typeof loggerInstance.logError).toBe('function');
  });
});