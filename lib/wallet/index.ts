export * from './types';
export { WalletProvider, useWallet } from './WalletProvider';

// Re-export from new auth system for backward compatibility
export { useWallet as useWalletNew, useAuth } from '../auth';