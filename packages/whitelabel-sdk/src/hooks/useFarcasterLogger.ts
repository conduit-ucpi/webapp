import { useCallback } from 'react';
import { 
  farcasterLog, 
  farcasterWarn, 
  farcasterError, 
  farcasterInfo,
  farcasterDebug,
  logContractOperation,
  logAuthOperation,
  logWeb3Operation,
  logAPICall,
  logError
} from '@/utils/farcasterLogger';

/**
 * Hook that provides enhanced logging functions for use throughout the app
 * These functions work both in regular browser and Farcaster environments
 */
export const useFarcasterLogger = () => {
  const log = useCallback((message: string, data?: any) => {
    farcasterLog(message, data);
  }, []);

  const warn = useCallback((message: string, data?: any) => {
    farcasterWarn(message, data);
  }, []);

  const error = useCallback((message: string, data?: any) => {
    farcasterError(message, data);
  }, []);

  const info = useCallback((message: string, data?: any) => {
    farcasterInfo(message, data);
  }, []);

  const debug = useCallback((message: string, data?: any) => {
    farcasterDebug(message, data);
  }, []);

  const logContract = useCallback((operation: string, contractId?: string, data?: any) => {
    logContractOperation(operation, contractId, data);
  }, []);

  const logAuth = useCallback((operation: string, data?: any) => {
    logAuthOperation(operation, data);
  }, []);

  const logWeb3 = useCallback((operation: string, data?: any) => {
    logWeb3Operation(operation, data);
  }, []);

  const logAPI = useCallback((endpoint: string, method: string = 'GET', data?: any) => {
    logAPICall(endpoint, method, data);
  }, []);

  const logErrorWithContext = useCallback((operation: string, error: Error | string, context?: any) => {
    logError(operation, error, context);
  }, []);

  return {
    log,
    warn,
    error,
    info,
    debug,
    logContract,
    logAuth,
    logWeb3,
    logAPI,
    logError: logErrorWithContext,
  };
};