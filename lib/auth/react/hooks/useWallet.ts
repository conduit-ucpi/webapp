/**
 * Wallet-specific hook for blockchain operations
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { TransactionManager, TransactionResult, TransactionOptions } from '../../blockchain/TransactionManager';

export function useWallet() {
  const { provider, isConnected } = useAuth();

  const getTransactionManager = useCallback((): TransactionManager | null => {
    if (!provider) return null;
    return new TransactionManager(provider);
  }, [provider]);

  const getAddress = useCallback(async (): Promise<string | null> => {
    if (!provider) return null;
    return await provider.getAddress();
  }, [provider]);

  const getBalance = useCallback(async (address?: string): Promise<bigint | null> => {
    if (!provider) return null;
    return await provider.getBalance(address);
  }, [provider]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!provider) throw new Error('No wallet connected');
    return await provider.signMessage(message);
  }, [provider]);

  const sendTransaction = useCallback(async (
    to: string,
    data: string,
    options?: TransactionOptions
  ): Promise<TransactionResult> => {
    const txManager = getTransactionManager();
    if (!txManager) throw new Error('No wallet connected');
    return await txManager.sendTransaction(to, data, options);
  }, [getTransactionManager]);

  const callContract = useCallback(async (
    contractAddress: string,
    abi: any,
    methodName: string,
    params: any[] = []
  ): Promise<any> => {
    const txManager = getTransactionManager();
    if (!txManager) throw new Error('No wallet connected');
    return await txManager.callContract(contractAddress, abi, methodName, params);
  }, [getTransactionManager]);

  const sendContractTransaction = useCallback(async (
    contractAddress: string,
    abi: any,
    methodName: string,
    params: any[] = [],
    options?: TransactionOptions
  ): Promise<TransactionResult> => {
    const txManager = getTransactionManager();
    if (!txManager) throw new Error('No wallet connected');
    return await txManager.sendContractTransaction(contractAddress, abi, methodName, params, options);
  }, [getTransactionManager]);

  const switchNetwork = useCallback(async (chainId: number): Promise<boolean> => {
    if (!provider) return false;
    return await provider.switchNetwork(chainId);
  }, [provider]);

  const getNetwork = useCallback(async () => {
    if (!provider) return null;
    return await provider.getNetwork();
  }, [provider]);

  return {
    // State
    isConnected,
    provider,

    // Basic operations
    getAddress,
    getBalance,
    signMessage,
    getNetwork,
    switchNetwork,

    // Transaction operations
    sendTransaction,
    callContract,
    sendContractTransaction,

    // Advanced
    getTransactionManager
  };
}