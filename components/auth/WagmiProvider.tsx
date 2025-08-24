import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';

interface WagmiProviderWrapperProps {
  children: ReactNode;
}

// Create wagmi config for Farcaster auth
const config = createConfig({
  chains: [avalanche, avalancheFuji],
  transports: {
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
  },
});

export function WagmiProviderWrapper({ children }: WagmiProviderWrapperProps) {
  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}