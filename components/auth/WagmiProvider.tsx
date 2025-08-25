import { ReactNode } from 'react';

// Import wagmi components - these will be mocked in test environment
import { WagmiProvider, createConfig, http } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface WagmiProviderWrapperProps {
  children: ReactNode;
}

// Create wagmi config and QueryClient for Farcaster auth
const config = createConfig({
  chains: [avalanche, avalancheFuji],
  transports: {
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function WagmiProviderWrapper({ children }: WagmiProviderWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}