/**
 * Wallet-specific hook for blockchain operations
 * Note: This hook is deprecated - use useSimpleEthers instead
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { TransactionManager, TransactionResult, TransactionOptions } from '../../blockchain/TransactionManager';
import { ethers } from 'ethers';

export function useWallet() {
  const { isConnected, getEthersProvider } = useAuth();

  const getTransactionManager = useCallback(async (): Promise<TransactionManager | null> => {
    const provider = await getEthersProvider();
    if (!provider) return null;
    return new TransactionManager(provider);
  }, [getEthersProvider]);

  const getAddress = useCallback(async (): Promise<string | null> => {
    const provider = await getEthersProvider();
    if (!provider) return null;
    const signer = await provider.getSigner();
    return await signer.getAddress();
  }, [getEthersProvider]);

  const getBalance = useCallback(async (address?: string): Promise<bigint | null> => {
    const provider = await getEthersProvider();
    if (!provider) return null;
    const targetAddress = address || await getAddress();
    if (!targetAddress) return null;
    return await provider.getBalance(targetAddress);
  }, [getEthersProvider, getAddress]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = await getEthersProvider();
    if (!provider) throw new Error('No wallet connected');
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
  }, [getEthersProvider]);

  const sendTransaction = useCallback(async (
    to: string,
    data: string,
    options?: TransactionOptions
  ): Promise<TransactionResult> => {
    const txManager = await getTransactionManager();
    if (!txManager) throw new Error('No wallet connected');
    return await txManager.sendTransaction(to, data, options);
  }, [getTransactionManager]);

  const callContract = useCallback(async (
    contractAddress: string,
    abi: any,
    methodName: string,
    params: any[] = []
  ): Promise<any> => {
    const txManager = await getTransactionManager();
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
    const txManager = await getTransactionManager();
    if (!txManager) throw new Error('No wallet connected');
    return await txManager.sendContractTransaction(contractAddress, abi, methodName, params, options);
  }, [getTransactionManager]);

  const switchNetwork = useCallback(async (chainId: number): Promise<boolean> => {
    const provider = await getEthersProvider();
    if (!provider) return false;

    try {
      // Use provider's underlying provider for EIP-1193 requests
      const rawProvider = (provider as any)._getProvider?.() || (provider as any).provider;
      if (rawProvider?.request) {
        const chainIdHex = `0x${chainId.toString(16)}`;
        await rawProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [getEthersProvider]);

  const getNetwork = useCallback(async () => {
    const provider = await getEthersProvider();
    if (!provider) return null;
    return await provider.getNetwork();
  }, [getEthersProvider]);

  return {
    // State
    isConnected,

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