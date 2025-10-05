/**
 * Main auth module exports
 * Public API for the reorganized authentication system
 */

// Types
export type {
  AuthUser,
  AuthState,
  AuthResult,
  BackendAuthResult,
  WalletProvider,
  AuthProvider as AuthProviderInterface,
  AuthConfig,
  ProviderType,
  AuthContextType
} from './types';

// Core (framework-agnostic)
export { AuthManager } from './core/AuthManager';
export { ProviderRegistry } from './core/ProviderRegistry';
export { TokenManager } from './core/TokenManager';

// Providers
export { Web3AuthProvider } from './providers/Web3AuthProvider';
export { FarcasterProvider } from './providers/FarcasterProvider';

// Backend
export { BackendClient } from './backend/BackendClient';
export { AuthService } from './backend/AuthService';

// Blockchain
export { ProviderWrapper } from './blockchain/ProviderWrapper';
export { TransactionManager } from './blockchain/TransactionManager';
export type { TransactionOptions, TransactionResult } from './blockchain/TransactionManager';

// React integration
export { AuthProvider } from './react/AuthProvider';
export { useAuth } from './react/hooks/useAuth';
export { useWallet } from './react/hooks/useWallet';
export { useBackendAuth } from './react/hooks/useBackendAuth';