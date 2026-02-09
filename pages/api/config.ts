import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { TokenDetails } from '../../types';
import { TokenConfig, parseTokensFromEnv } from '../../types/tokens';

// ERC20 ABI for fetching token details
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)'
];

/**
 * Fetch token details from the blockchain
 * @param rpcUrl RPC endpoint URL
 * @param tokenAddress Token contract address
 * @param tokenLabel Label for logging (e.g., "USDC", "USDT")
 * @returns Token details (symbol, decimals, name)
 */
async function getTokenDetails(
  rpcUrl: string,
  tokenAddress: string,
  tokenLabel: string
): Promise<TokenDetails | null> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [symbol, decimals, name] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.name()
    ]);

    console.log(`✅ Fetched ${tokenLabel} token details from blockchain:`, {
      address: tokenAddress,
      symbol,
      decimals: Number(decimals),
      name
    });

    return {
      address: tokenAddress,
      symbol,
      decimals: Number(decimals),
      name
    };
  } catch (error) {
    console.error(`Failed to fetch ${tokenLabel} token details:`, error);
    return null;
  }
}

/**
 * Fetch contract addresses from chainservice
 * @param chainServiceUrl Chain service base URL
 * @returns Contract addresses (factoryAddress, implementationAddress)
 * @throws Error if chainservice is unavailable or returns invalid data
 */
async function getContractAddresses(
  chainServiceUrl: string
): Promise<{ factoryAddress: string; implementationAddress: string }> {
  const url = `${chainServiceUrl}/api/chain/addresses`;
  console.log(`Fetching contract addresses from chainservice: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Chainservice returned status ${response.status}`);
  }

  const data = await response.json();

  if (!data.factoryAddress || !data.implementationAddress) {
    throw new Error('Chainservice returned incomplete contract addresses');
  }

  console.log('✅ Fetched contract addresses from chainservice:', {
    factoryAddress: data.factoryAddress,
    implementationAddress: data.implementationAddress,
    timestamp: data.timestamp
  });

  return {
    factoryAddress: data.factoryAddress,
    implementationAddress: data.implementationAddress
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Debug logging
    console.log('Environment variables check:');
    console.log('NEXT_PUBLIC_BASE_PATH:', process.env.NEXT_PUBLIC_BASE_PATH);
    console.log('CHAIN_ID:', process.env.CHAIN_ID);
    console.log('RPC_URL:', process.env.RPC_URL || 'MISSING - THIS WILL CAUSE ERRORS');
    console.log('RPC_URL raw bytes:', process.env.RPC_URL ? Array.from(process.env.RPC_URL).map(c => c.charCodeAt(0)) : 'N/A');
    console.log('RPC_URL trimmed:', process.env.RPC_URL?.trim());
    console.log('RPC_URL trimmed bytes:', process.env.RPC_URL?.trim() ? Array.from(process.env.RPC_URL.trim()).map(c => c.charCodeAt(0)) : 'N/A');
    console.log('SUPPORTED_TOKENS:', process.env.SUPPORTED_TOKENS ? 'Configured' : 'Not configured');
    console.log('USDC_CONTRACT_ADDRESS (legacy):', process.env.USDC_CONTRACT_ADDRESS);
    console.log('USDT_CONTRACT_ADDRESS (legacy):', process.env.USDT_CONTRACT_ADDRESS);
    console.log('DEFAULT_TOKEN_SYMBOL:', process.env.DEFAULT_TOKEN_SYMBOL);
    console.log('MOONPAY_API_KEY:', process.env.MOONPAY_API_KEY ? 'Present' : 'Missing');
    console.log('MIN_GAS_WEI:', process.env.MIN_GAS_WEI);
    console.log('MAX_GAS_PRICE_GWEI:', process.env.MAX_GAS_PRICE_GWEI);
    console.log('MAX_GAS_COST_GWEI:', process.env.MAX_GAS_COST_GWEI);
    console.log('USDC_GRANT_FOUNDRY_GAS:', process.env.USDC_GRANT_FOUNDRY_GAS);
    console.log('DEPOSIT_FUNDS_FOUNDRY_GAS:', process.env.DEPOSIT_FUNDS_FOUNDRY_GAS);
    console.log('RESOLUTION_VOTE_FOUNDRY_GAS:', process.env.RESOLUTION_VOTE_FOUNDRY_GAS);
    console.log('RAISE_DISPUTE_FOUNDRY_GAS:', process.env.RAISE_DISPUTE_FOUNDRY_GAS);
    console.log('CLAIM_FUNDS_FOUNDRY_GAS:', process.env.CLAIM_FUNDS_FOUNDRY_GAS);
    console.log('GAS_PRICE_BUFFER:', process.env.GAS_PRICE_BUFFER);
    console.log('EXPLORER_BASE_URL:', process.env.EXPLORER_BASE_URL);
    console.log('SERVICE_LINK:', process.env.SERVICE_LINK);
    console.log('CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
    console.log('WALLETCONNECT_PROJECT_ID:', process.env.WALLETCONNECT_PROJECT_ID ? 'Present' : 'Missing');

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH === 'null' ? '' : (process.env.NEXT_PUBLIC_BASE_PATH || '/webapp');

    // Validate critical configuration
    if (!process.env.RPC_URL) {
      throw new Error('RPC_URL environment variable is required but not set');
    }
    if (!process.env.CHAIN_SERVICE_URL) {
      console.error('CHAIN_SERVICE_URL is missing - required for fetching contract addresses');
      return res.status(500).json({ error: 'Chain service URL not configured' });
    }

    // Parse token configuration from SUPPORTED_TOKENS env var (with fallback to legacy env vars)
    let tokenConfigs: TokenConfig[] = [];

    if (process.env.SUPPORTED_TOKENS) {
      // Use new JSON configuration
      tokenConfigs = parseTokensFromEnv(process.env.SUPPORTED_TOKENS);
      console.log('✅ Loaded token configuration from SUPPORTED_TOKENS:', tokenConfigs.map(t => t.symbol));
    } else {
      // Fallback to legacy individual env vars
      console.warn('⚠️ SUPPORTED_TOKENS not found, using legacy env vars');
      const legacyTokens: TokenConfig[] = [];

      if (process.env.USDC_CONTRACT_ADDRESS) {
        legacyTokens.push({
          symbol: 'USDC',
          address: process.env.USDC_CONTRACT_ADDRESS,
          name: 'USD Coin',
          decimals: 6,
          isDefault: process.env.DEFAULT_TOKEN_SYMBOL !== 'USDT',
          enabled: true
        });
      }

      if (process.env.USDT_CONTRACT_ADDRESS) {
        legacyTokens.push({
          symbol: 'USDT',
          address: process.env.USDT_CONTRACT_ADDRESS,
          name: 'Tether USD',
          decimals: 6,
          isDefault: process.env.DEFAULT_TOKEN_SYMBOL === 'USDT',
          enabled: true
        });
      }

      if (legacyTokens.length === 0) {
        console.error('No token configuration found - neither SUPPORTED_TOKENS nor legacy env vars');
        return res.status(500).json({ error: 'Token configuration not found' });
      }

      tokenConfigs = legacyTokens;
    }

    // Fetch contract addresses from chainservice
    const contractAddresses = await getContractAddresses(process.env.CHAIN_SERVICE_URL);

    // Fetch on-chain details for all enabled tokens in parallel
    const enabledTokens = tokenConfigs.filter(t => t.enabled !== false);
    const tokenDetailsPromises = enabledTokens.map(token =>
      getTokenDetails(process.env.RPC_URL!.trim(), token.address, token.symbol)
        .then(details => ({ ...token, ...details }))
        .catch(err => {
          console.error(`Failed to fetch details for ${token.symbol}:`, err);
          return { ...token }; // Return config without on-chain details
        })
    );

    const supportedTokens = await Promise.all(tokenDetailsPromises);

    // Find the default token
    const defaultToken = supportedTokens.find(t => t.isDefault) || supportedTokens[0];

    // Legacy fields for backward compatibility
    const usdcDetails = supportedTokens.find(t => t.symbol === 'USDC') || null;
    const usdtDetails = supportedTokens.find(t => t.symbol === 'USDT') || null;

    const config = {
      chainId: parseInt(process.env.CHAIN_ID || '8453'), // Default: Base Mainnet
      rpcUrl: process.env.RPC_URL?.trim(),
      // New centralized token configuration
      supportedTokens: supportedTokens,
      defaultToken: defaultToken,
      // Legacy fields for backward compatibility
      usdcContractAddress: usdcDetails?.address,
      usdtContractAddress: usdtDetails?.address,
      usdcDetails: usdcDetails,
      usdtDetails: usdtDetails,
      tokenSymbol: defaultToken?.symbol || 'USDC',
      defaultTokenSymbol: defaultToken?.symbol || 'USDC',
      primaryToken: defaultToken,
      // Contract addresses
      contractAddress: contractAddresses.implementationAddress,
      contractFactoryAddress: contractAddresses.factoryAddress,
      // Service URLs
      userServiceUrl: process.env.USER_SERVICE_URL,
      chainServiceUrl: process.env.CHAIN_SERVICE_URL,
      contractServiceUrl: process.env.CONTRACT_SERVICE_URL,
      // Third-party services
      moonPayApiKey: process.env.MOONPAY_API_KEY,
      walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID,
      neynarApiKey: process.env.NEYNAR_API_KEY,
      // Gas configuration
      minGasWei: process.env.MIN_GAS_WEI || '5',
      maxGasPriceGwei: process.env.MAX_GAS_PRICE_GWEI || '0.001',
      maxGasCostGwei: process.env.MAX_GAS_COST_GWEI || '0.15',
      usdcGrantFoundryGas: process.env.USDC_GRANT_FOUNDRY_GAS || '150000',
      depositFundsFoundryGas: process.env.DEPOSIT_FUNDS_FOUNDRY_GAS || '150000',
      resolutionVoteFoundryGas: process.env.RESOLUTION_VOTE_FOUNDRY_GAS || '80000',
      raiseDisputeFoundryGas: process.env.RAISE_DISPUTE_FOUNDRY_GAS || '150000',
      claimFundsFoundryGas: process.env.CLAIM_FUNDS_FOUNDRY_GAS || '150000',
      gasPriceBuffer: process.env.GAS_PRICE_BUFFER || '1',
      // UI configuration
      basePath,
      explorerBaseUrl: process.env.EXPLORER_BASE_URL,
      serviceLink: process.env.SERVICE_LINK || 'http://localhost:3000',
      // Optional wallet services configuration
      walletServicesShowWidget: process.env.WALLET_SERVICES_SHOW_WIDGET,
      walletServicesButtonPosition: process.env.WALLET_SERVICES_BUTTON_POSITION,
      walletServicesEnableKeyExport: process.env.WALLET_SERVICES_ENABLE_KEY_EXPORT,
      walletServicesHideTopup: process.env.WALLET_SERVICES_HIDE_TOPUP,
      // Build information
      gitTag: process.env.GIT_TAG || 'unknown',
      gitSha: process.env.GIT_SHA || 'unknown',
      buildVersion: process.env.BUILD_VERSION || 'unknown'
    };

    console.log('Config being sent:', config);
    res.status(200).json(config);
  } catch (error) {
    console.error('Config loading error:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
}