// Network utilities - extracting from web3authConfig.ts to avoid duplication

/**
 * Get network information from chainId
 * This uses the same mapping logic as web3authConfig.ts
 */
export function getNetworkInfo(chainId: number): { name: string; ticker: string; tickerName: string; logo: string } {
  const chainConfigs: Record<number, { name: string; ticker: string; tickerName: string; logo: string }> = {
    // Ethereum
    1: { name: 'Ethereum Mainnet', ticker: 'ETH', tickerName: 'Ethereum', logo: 'https://images.toruswallet.io/ethereum.svg' },
    11155111: { name: 'Sepolia Testnet', ticker: 'ETH', tickerName: 'Sepolia ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    
    // Avalanche
    43114: { name: 'Avalanche C-Chain', ticker: 'AVAX', tickerName: 'Avalanche', logo: 'https://images.toruswallet.io/avax.svg' },
    43113: { name: 'Avalanche Fuji Testnet', ticker: 'AVAX', tickerName: 'Avalanche', logo: 'https://images.toruswallet.io/avax.svg' },
    
    // Polygon
    137: { name: 'Polygon Mainnet', ticker: 'MATIC', tickerName: 'Polygon', logo: 'https://images.toruswallet.io/polygon.svg' },
    80001: { name: 'Mumbai Testnet', ticker: 'MATIC', tickerName: 'Mumbai MATIC', logo: 'https://images.toruswallet.io/polygon.svg' },
    
    // Base
    8453: { name: 'Base Mainnet', ticker: 'ETH', tickerName: 'Base ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    84532: { name: 'Base Sepolia', ticker: 'ETH', tickerName: 'Base Sepolia ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    
    // Arbitrum
    42161: { name: 'Arbitrum One', ticker: 'ETH', tickerName: 'Arbitrum ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    421614: { name: 'Arbitrum Sepolia', ticker: 'ETH', tickerName: 'Arbitrum Sepolia ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    
    // Optimism
    10: { name: 'Optimism Mainnet', ticker: 'ETH', tickerName: 'Optimism ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    11155420: { name: 'Optimism Sepolia', ticker: 'ETH', tickerName: 'Optimism Sepolia ETH', logo: 'https://images.toruswallet.io/ethereum.svg' },
    
    // BSC
    56: { name: 'BNB Smart Chain', ticker: 'BNB', tickerName: 'BNB', logo: 'https://images.toruswallet.io/binance.svg' },
    97: { name: 'BSC Testnet', ticker: 'BNB', tickerName: 'Test BNB', logo: 'https://images.toruswallet.io/binance.svg' },
  };
  
  return chainConfigs[chainId] || {
    name: `EVM Chain ${chainId}`,
    ticker: 'ETH',
    tickerName: 'Native Token',
    logo: 'https://images.toruswallet.io/ethereum.svg'
  };
}

/**
 * Get just the network name from chainId
 */
export function getNetworkName(chainId: number): string {
  return getNetworkInfo(chainId).name;
}