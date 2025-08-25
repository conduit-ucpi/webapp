import { useAuth } from '@/components/auth/AuthProvider';

export function useWalletAddress() {
  const { walletAddress, isLoading } = useAuth();
  return { walletAddress, isLoading };
}