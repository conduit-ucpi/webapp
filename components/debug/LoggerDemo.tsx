import React from 'react';
import { useFarcasterLogger } from '@/hooks/useFarcasterLogger';
import { useFarcaster } from '../farcaster/FarcasterDetectionProvider';

/**
 * Demo component to test the Farcaster logging system
 * Only visible in development mode or when running in Farcaster
 */
export const LoggerDemo: React.FC = () => {
  const { isInFarcaster } = useFarcaster();
  const logger = useFarcasterLogger();

  // Only show in development or Farcaster
  if (process.env.NODE_ENV === 'production' && !isInFarcaster) {
    return null;
  }

  const testLogs = () => {
    console.log('LoggerDemo: Starting test logs');
    
    // Test basic console methods
    console.log('Direct console.log test');
    console.warn('Direct console.warn test');
    console.error('Direct console.error test');
    console.info('Direct console.info test');
    
    // Test logger functions
    logger.log('Test log message', { test: 'data' });
    logger.info('Test info message');
    logger.warn('Test warning message');
    logger.error('Test error message');
    logger.debug('Test debug message');
    
    logger.logContract('create', 'contract-123', { amount: 1000000 });
    logger.logAuth('login', { wallet: '0x123...' });
    logger.logWeb3('transaction', { hash: '0xabc...' });
    logger.logAPI('/api/contracts', 'POST', { data: 'example' });
    logger.logError('demo operation', new Error('This is a test error'), { context: 'demo' });
    
    console.log('LoggerDemo: Finished test logs');
  };

  return (
    <div className="fixed top-4 left-4 z-40">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <div className="text-sm text-gray-300 mb-2">
          {isInFarcaster ? '🚀 Running in Farcaster' : '💻 Development Mode'}
        </div>
        <button
          onClick={testLogs}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
        >
          Test Logs
        </button>
      </div>
    </div>
  );
};