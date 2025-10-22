/**
 * Hybrid EIP-1193 Provider
 *
 * Routes requests intelligently between two providers:
 * - READ operations (eth_getBalance, eth_call, etc.) → HTTP RPC provider
 * - WRITE operations (personal_sign, eth_sendTransaction, etc.) → WalletConnect provider
 *
 * This solves the mobile MetaMask issue where WalletConnect does not support
 * public/node RPC methods like eth_getBalance and eth_call.
 *
 * From Viem documentation:
 * "Wallet Client doesn't support public actions because wallet providers
 *  (like WalletConnect) may not provide 'node'/'public' RPC methods."
 */

import { mLog } from '@/utils/mobileLogger';

export interface HybridProviderConfig {
  /** Provider for read operations (HTTP RPC) */
  readProvider: any;
  /** Provider for write operations (WalletConnect) */
  walletProvider: any;
  /** Chain ID for the network */
  chainId: number;
}

/**
 * Creates a hybrid EIP-1193 provider that routes requests to appropriate providers
 */
export function createHybridProvider(config: HybridProviderConfig): any {
  const { readProvider, walletProvider, chainId } = config;

  // Methods that should be routed to the wallet provider (write operations)
  const WALLET_METHODS = new Set([
    // Signing operations
    'personal_sign',
    'eth_sign',
    'eth_signTypedData',
    'eth_signTypedData_v1',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',

    // Transaction operations
    'eth_sendTransaction',
    'eth_signTransaction',

    // Network operations
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',

    // Account operations (wallet knows the connected accounts)
    'eth_accounts',
    'eth_requestAccounts',

    // NONCE FIX: Query nonce from wallet provider for hash consistency
    // When signer.sendTransaction() queries nonce BEFORE app-switch, wallet provider works fine.
    // This ensures nonce comes from same source that validates it (the wallet).
    // After app-switch, we only poll eth_getTransactionReceipt (routed to Base RPC), never nonce.
    'eth_getTransactionCount',
  ]);

  // Methods that should be routed to the read provider (public RPC)
  const READ_METHODS = new Set([
    // Chain ID (read-only network info - doesn't require wallet)
    // MOBILE FIX: After app-switching, wallet provider breaks and eth_chainId hangs
    // Route to reliable Base RPC instead
    'eth_chainId',

    // Balance and state queries
    'eth_getBalance',
    'eth_getCode',
    'eth_getStorageAt',

    // Transaction info
    'eth_getTransactionByHash',
    'eth_getTransactionReceipt',
    // NOTE: eth_getTransactionCount moved to WALLET_METHODS for nonce hash consistency

    // Block info
    'eth_blockNumber',
    'eth_getBlockByNumber',
    'eth_getBlockByHash',

    // Contract calls
    'eth_call',
    'eth_estimateGas',

    // Gas pricing
    'eth_gasPrice',
    'eth_feeHistory',
    'eth_maxPriorityFeePerGas',

    // Logs and filters
    'eth_getLogs',
    'eth_newFilter',
    'eth_getFilterChanges',
    'eth_uninstallFilter',
  ]);

  // Helper to call provider (handles both EIP-1193 and ethers.JsonRpcProvider)
  const callProvider = async (provider: any, args: { method: string; params?: any[] }) => {
    // Check if it's an EIP-1193 provider with .request()
    if (provider.request && typeof provider.request === 'function') {
      return provider.request(args);
    }
    // Check if it's an ethers.JsonRpcProvider with .send()
    else if (provider.send && typeof provider.send === 'function') {
      return provider.send(args.method, args.params || []);
    }
    else {
      throw new Error(`Provider does not support .request() or .send() methods`);
    }
  };

  // Create the hybrid provider
  const hybridProvider = {
    async request(args: { method: string; params?: any[] }): Promise<any> {
      const { method, params } = args;

      // Route to appropriate provider
      if (WALLET_METHODS.has(method)) {
        mLog.debug('HybridProvider', `📝 Routing ${method} to wallet provider`);
        return callProvider(walletProvider, args);
      } else if (READ_METHODS.has(method)) {
        mLog.debug('HybridProvider', `📖 Routing ${method} to read provider`);
        return callProvider(readProvider, args);
      } else {
        // Unknown method - try wallet provider first, fall back to read provider
        mLog.warn('HybridProvider', `⚠️  Unknown method ${method}, trying wallet provider first`);
        try {
          return await callProvider(walletProvider, args);
        } catch (error) {
          mLog.warn('HybridProvider', `Wallet provider failed for ${method}, trying read provider`, {
            error: error instanceof Error ? error.message : String(error)
          });
          return callProvider(readProvider, args);
        }
      }
    },

    // Standard EIP-1193 events
    on: (event: string, listener: (...args: any[]) => void) => {
      // Forward events from wallet provider (accountsChanged, chainChanged, etc.)
      if (walletProvider.on) {
        walletProvider.on(event, listener);
      }
    },

    removeListener: (event: string, listener: (...args: any[]) => void) => {
      if (walletProvider.removeListener) {
        walletProvider.removeListener(event, listener);
      }
    },
  };

  mLog.info('HybridProvider', '✅ Created hybrid provider', {
    chainId,
    hasReadProvider: !!readProvider,
    hasWalletProvider: !!walletProvider,
    readMethods: READ_METHODS.size,
    walletMethods: WALLET_METHODS.size,
  });

  return hybridProvider;
}

/**
 * Universal wrapper that creates a hybrid provider for ANY wallet connection
 *
 * This ensures ALL wallets (MetaMask, Web3Auth, Dynamic, WalletConnect, etc.)
 * route READ operations through our reliable Base RPC instead of using the
 * wallet's potentially flaky or unsupported RPC methods.
 *
 * Benefits:
 * - Consistent gas pricing from our Base RPC
 * - Avoids wallet-specific RPC quirks (like MetaMask's missing eth_maxPriorityFeePerGas)
 * - Single source of truth for blockchain state
 * - Wallets only handle what they're good at: signing and transactions
 *
 * @param walletProvider - Any wallet provider (MetaMask, Web3Auth, Dynamic, etc.)
 * @param config - Auth config containing RPC URL and chain ID
 * @returns Hybrid provider that routes reads to Base RPC and writes to wallet
 */
export function wrapWithHybridProvider(walletProvider: any, config: { rpcUrl: string; chainId: number }): any {
  const { JsonRpcProvider } = require('ethers');

  mLog.info('HybridProviderFactory', '🔧 Creating universal hybrid provider wrapper', {
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    walletProvider: typeof walletProvider
  });

  // Create read provider from our reliable RPC
  const readProvider = new JsonRpcProvider(config.rpcUrl, config.chainId);

  // Create hybrid provider
  const hybridProvider = createHybridProvider({
    readProvider,
    walletProvider,
    chainId: config.chainId
  });

  mLog.info('HybridProviderFactory', '✅ Universal hybrid provider created - all wallets now use Base RPC for reads');

  return hybridProvider;
}
