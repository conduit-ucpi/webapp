import { WALLET_CONNECTORS, WEB3AUTH_NETWORK } from "@web3auth/modal";
import { Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";

// This matches the pattern from the Web3Auth examples
export const createWeb3AuthConfig = (config: {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  web3AuthNetwork: string;
}): Web3AuthContextConfig => {
  // Determine network details based on chainId
  const getNetworkInfo = () => {
    // Common chain configurations
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
    
    // Return specific config if known, otherwise generic EVM config
    return chainConfigs[config.chainId] || {
      name: `EVM Chain ${config.chainId}`,
      ticker: 'ETH',
      tickerName: 'Native Token',
      logo: 'https://images.toruswallet.io/ethereum.svg'
    };
  };

  const networkInfo = getNetworkInfo();

  const chainConfig: CustomChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: `0x${config.chainId.toString(16)}`, // Convert to hex
    rpcTarget: config.rpcUrl,
    displayName: networkInfo.name,
    blockExplorerUrl: config.explorerBaseUrl,
    ticker: networkInfo.ticker,
    tickerName: networkInfo.tickerName,
    logo: networkInfo.logo,
  };

  console.log('🔧 Web3Auth chainConfig created:', {
    inputChainId: config.chainId,
    hexChainId: chainConfig.chainId,
    displayName: chainConfig.displayName,
    rpcTarget: chainConfig.rpcTarget,
    web3AuthNetwork: config.web3AuthNetwork
  });

  return {
    web3AuthOptions: {
      clientId: config.web3AuthClientId,
      web3AuthNetwork: config.web3AuthNetwork as any, // Will be WEB3AUTH_NETWORK.SAPPHIRE_MAINNET or similar
      chainConfig,
      uiConfig: {
        appName: "Conduit UCPI",
        theme: {
          primary: "#0364ff",
        },
        mode: "auto",
        logoLight: "https://web3auth.io/images/web3authlog.png",
        logoDark: "https://web3auth.io/images/web3authlogodark.png",
        defaultLanguage: "en",
        loginGridCol: 3,
        primaryButton: "externalLogin",
      },
      modalConfig: {
        connectors: {
          [WALLET_CONNECTORS.AUTH]: {
            label: "auth",
            loginMethods: {
              google: {
                name: "google login",
                showOnModal: true,
              },
              facebook: {
                name: "facebook login", 
                showOnModal: true,
              },
              email_passwordless: {
                name: "email passwordless login",
                showOnModal: true,
              },
            },
            showOnModal: true,
          },
        },
      },
    },
  } as Web3AuthContextConfig;
};