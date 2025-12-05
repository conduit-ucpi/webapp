import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getNetworkInfo } from "@/utils/networkUtils";
import { toHexString } from "@/utils/hexUtils";
import { mLog } from "@/utils/mobileLogger";

// This creates the Dynamic configuration
// Note: wagmiConfig is provided via WagmiProvider React context, not passed here
export const createDynamicConfig = (config: {
  dynamicEnvironmentId: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  usdcContractAddress?: string;
  usdtContractAddress?: string;
}) => {
  mLog.info('DynamicConfig', 'Creating Dynamic configuration');
  
  const networkInfo = getNetworkInfo(config.chainId);
  
  const dynamicSettings = {
    environmentId: config.dynamicEnvironmentId,
    // Use connect-only mode to skip Dynamic's message signing verification
    // We handle authentication via our backend with message signing there,
    // so we don't need Dynamic to do it during wallet connection
    initialAuthenticationMode: 'connect-only' as const,

    // NOTE: wagmiConfig is provided via WagmiProvider context, not as a direct property
    // Dynamic's ethers toolkit will read PublicClient from wagmi's React context

    // Mobile wallet redirect configuration
    // This tells mobile wallets (Trust Wallet, MetaMask, etc.) to redirect back after connection
    mobileExperience: 'redirect' as const, // Use redirect mode instead of in-app browser
    deepLinkPreference: 'universal' as const, // Use universal links (HTTPS) for redirects

    walletConnectors: [
      (props: any) => EthereumWalletConnectors({
        ...props,
        useMetamaskSdk: false, // Disable MetaMask SDK - force WalletConnect for MetaMask
      })
    ],

    // Only show MetaMask and WalletConnect in the wallet list
    // Social logins (Google, etc.) are always shown and controlled in Dynamic dashboard
    // WalletConnect allows users to connect any wallet they want (Trust, Coinbase, etc.)
    walletsFilter: (wallets: any[]) => {
      const allowedWallets = ['metamask', 'walletconnect'];
      return wallets.filter((wallet: any) => allowedWallets.includes(wallet.key));
    },
    overrides: {
      // Enable multi-asset to show ERC20 token balances in the widget
      multiAsset: true,
      evmNetworks: [
        {
          blockExplorerUrls: [config.explorerBaseUrl],
          chainId: config.chainId,
          chainName: networkInfo.name,
          iconUrls: [],
          name: networkInfo.name,
          nativeCurrency: {
            decimals: 18,
            name: networkInfo.ticker,
            symbol: networkInfo.ticker
          },
          networkId: config.chainId,
          rpcUrls: [config.rpcUrl],
          vanityName: networkInfo.name,
          // Add ERC20 tokens to display in the Dynamic embedded wallet widget
          ercTokens: [
            ...(config.usdcContractAddress ? [{
              address: config.usdcContractAddress,
              decimals: 6,
              name: 'USD Coin',
              symbol: 'USDC',
              chainId: config.chainId
            }] : []),
            ...(config.usdtContractAddress ? [{
              address: config.usdtContractAddress,
              decimals: 6,
              name: 'Tether USD',
              symbol: 'USDT',
              chainId: config.chainId
            }] : [])
          ]
        }
      ]
    }
  };

  // Log the configuration for debugging
  const ercTokens = dynamicSettings.overrides.evmNetworks[0].ercTokens || [];
  mLog.info('DynamicConfig', 'Dynamic settings created', {
    environmentId: config.dynamicEnvironmentId.substring(0, 10) + '...',
    chainId: config.chainId,
    networkName: networkInfo.name,
    multiAsset: dynamicSettings.overrides.multiAsset,
    mobileExperience: dynamicSettings.mobileExperience,
    deepLinkPreference: dynamicSettings.deepLinkPreference,
    hasWalletConnectors: !!dynamicSettings.walletConnectors,
    connectorCount: dynamicSettings.walletConnectors?.length || 0,
    walletsFilter: 'metamask, walletconnect only',
    ercTokenCount: ercTokens.length,
    tokens: ercTokens.map((t: any) => `${t.symbol} (${t.address.substring(0, 8)}...)`)
  });

  // Log full token details for verification
  if (ercTokens.length > 0) {
    mLog.info('DynamicConfig', 'ERC20 tokens configured for Dynamic widget:', ercTokens);
  } else {
    mLog.warn('DynamicConfig', 'No ERC20 tokens configured!', {
      hasUsdcAddress: !!config.usdcContractAddress,
      hasUsdtAddress: !!config.usdtContractAddress,
      usdcAddress: config.usdcContractAddress || 'NOT_PROVIDED',
      usdtAddress: config.usdtContractAddress || 'NOT_PROVIDED'
    });
  }

  // Log which connectors are actually available
  try {
    if (dynamicSettings.walletConnectors && dynamicSettings.walletConnectors.length > 0) {
      const connectorFunc = dynamicSettings.walletConnectors[0];
      if (typeof connectorFunc === 'function') {
        const connectors = connectorFunc({});
        mLog.info('DynamicConfig', 'Available wallet connectors', {
          connectorNames: connectors?.map((c: any) => c.name || c.constructor?.name || 'unknown') || [],
          connectorCount: connectors?.length || 0
        });
      }
    }
  } catch (error) {
    mLog.warn('DynamicConfig', 'Failed to enumerate connectors', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return dynamicSettings;
};