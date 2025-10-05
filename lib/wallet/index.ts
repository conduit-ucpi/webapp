export * from './types';

// Re-export from new auth system for backward compatibility
export { useWallet, useAuth } from '../auth';