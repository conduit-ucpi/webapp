/**
 * Utility functions for Farcaster logging
 * This module provides convenient logging functions that work both inside and outside Farcaster
 */

// Global reference to logger context (set by FarcasterLoggerProvider)
let loggerInstance: {
  addLog: (level: 'log' | 'warn' | 'error' | 'info', message: string, data?: any) => void;
} | null = null;

export const setLoggerInstance = (instance: typeof loggerInstance) => {
  loggerInstance = instance;
};

/**
 * Enhanced console.log that also captures logs in Farcaster environment
 */
export const farcasterLog = (message: string, data?: any) => {
  console.log(message, data);
  if (loggerInstance) {
    loggerInstance.addLog('log', message, data);
  }
};

/**
 * Enhanced console.warn that also captures logs in Farcaster environment
 */
export const farcasterWarn = (message: string, data?: any) => {
  console.warn(message, data);
  if (loggerInstance) {
    loggerInstance.addLog('warn', message, data);
  }
};

/**
 * Enhanced console.error that also captures logs in Farcaster environment
 */
export const farcasterError = (message: string, data?: any) => {
  console.error(message, data);
  if (loggerInstance) {
    loggerInstance.addLog('error', message, data);
  }
};

/**
 * Enhanced console.info that also captures logs in Farcaster environment
 */
export const farcasterInfo = (message: string, data?: any) => {
  console.info(message, data);
  if (loggerInstance) {
    loggerInstance.addLog('info', message, data);
  }
};

/**
 * Debug-specific logging that only shows in development or Farcaster
 */
export const farcasterDebug = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.parent !== window)) {
    farcasterLog(`[DEBUG] ${message}`, data);
  }
};

/**
 * Log contract-related operations
 */
export const logContractOperation = (operation: string, contractId?: string, data?: any) => {
  const message = contractId 
    ? `Contract ${operation}: ${contractId}` 
    : `Contract ${operation}`;
  farcasterInfo(message, data);
};

/**
 * Log authentication operations
 */
export const logAuthOperation = (operation: string, data?: any) => {
  farcasterInfo(`Auth ${operation}`, data);
};

/**
 * Log Web3 operations
 */
export const logWeb3Operation = (operation: string, data?: any) => {
  farcasterInfo(`Web3 ${operation}`, data);
};

/**
 * Log API calls
 */
export const logAPICall = (endpoint: string, method: string = 'GET', data?: any) => {
  farcasterDebug(`API ${method} ${endpoint}`, data);
};

/**
 * Log errors with context
 */
export const logError = (operation: string, error: Error | string, context?: any) => {
  const errorMessage = error instanceof Error ? error.message : error;
  farcasterError(`Error in ${operation}: ${errorMessage}`, {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context
  });
};