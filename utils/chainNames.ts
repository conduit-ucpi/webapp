// Chain name mappings for consistent display across the app
export const chainNames: Record<number, string> = {
  // Ethereum
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia Testnet',
  
  // Avalanche
  43114: 'Avalanche C-Chain',
  43113: 'Avalanche Fuji Testnet',
  
  // Polygon
  137: 'Polygon Mainnet',
  80001: 'Mumbai Testnet',
  
  // Base
  8453: 'Base Mainnet',
  84532: 'Base Sepolia',
  
  // Arbitrum
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
  
  // Optimism
  10: 'Optimism Mainnet',
  11155420: 'Optimism Sepolia',
  
  // BSC
  56: 'BNB Smart Chain',
  97: 'BSC Testnet',
};

export const getChainName = (chainId: number): string => {
  return chainNames[chainId] || `Chain ${chainId}`;
};

export const getChainShortName = (chainId: number): string => {
  // Return just the base name without "Mainnet", "Testnet", etc.
  const fullName = getChainName(chainId);
  
  const shortNames: Record<number, string> = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    43114: 'Avalanche',
    43113: 'Avalanche Fuji',
    137: 'Polygon',
    80001: 'Mumbai',
    8453: 'Base',
    84532: 'Base Sepolia',
    42161: 'Arbitrum',
    421614: 'Arbitrum Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
    56: 'BNB Chain',
    97: 'BSC Testnet',
  };
  
  return shortNames[chainId] || fullName;
};