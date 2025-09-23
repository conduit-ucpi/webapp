import { useAuth } from '@/components/auth';

export function useWalletAddress() {
  const { user, isLoading } = useAuth();
  
  return { 
    walletAddress: user?.walletAddress || null, 
    isLoading 
  };
}