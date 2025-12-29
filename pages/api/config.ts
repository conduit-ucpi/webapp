import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { TokenDetails } from '../../types';

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
    console.log('USDC_CONTRACT_ADDRESS:', process.env.USDC_CONTRACT_ADDRESS);
    console.log('USDT_CONTRACT_ADDRESS:', process.env.USDT_CONTRACT_ADDRESS);
    console.log('DEFAULT_TOKEN_SYMBOL:', process.env.DEFAULT_TOKEN_SYMBOL);
    console.log('MOONPAY_API_KEY:', process.env.MOONPAY_API_KEY ? 'Present' : 'Missing');
    console.log('MIN_GAS_WEI:', process.env.MIN_GAS_WEI);
    console.log('MAX_GAS_PRICE_GWEI:', process.env.MAX_GAS_PRICE_GWEI);
    console.log('MAX_GAS_COST_GWEI:', process.env.MAX_GAS_COST_GWEI);
    console.log('USDC_GRANT_FOUNDRY_GAS:', process.env.USDC_GRANT_FOUNDRY_GAS);
    console.log('DEPOSIT_FUNDS_FOUNDRY_GAS:', process.env.DEPOSIT_FUNDS_FOUNDRY_GAS);
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
    if (!process.env.USDC_CONTRACT_ADDRESS) {
      console.error('USDC_CONTRACT_ADDRESS is missing or null');
      return res.status(500).json({ error: 'USDC contract address not configured' });
    }

    // Fetch token details from blockchain for both USDC and USDT
    const [usdcDetails, usdtDetails] = await Promise.all([
      getTokenDetails(
        process.env.RPC_URL.trim(),
        process.env.USDC_CONTRACT_ADDRESS,
        'USDC'
      ),
      process.env.USDT_CONTRACT_ADDRESS
        ? getTokenDetails(
            process.env.RPC_URL.trim(),
            process.env.USDT_CONTRACT_ADDRESS,
            'USDT'
          )
        : Promise.resolve(null)
    ]);

    // Determine which token to use based on DEFAULT_TOKEN_SYMBOL
    const defaultSymbol = process.env.DEFAULT_TOKEN_SYMBOL || 'USDC';
    const primaryToken = defaultSymbol === 'USDT' && usdtDetails ? usdtDetails : usdcDetails;

    const config = {
      chainId: parseInt(process.env.CHAIN_ID || '8453'), // Default: Base Mainnet
      rpcUrl: process.env.RPC_URL?.trim(),
      usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS,
      usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS,
      contractAddress: process.env.CONTRACT_ADDRESS,
      contractFactoryAddress: process.env.CONTRACT_FACTORY_ADDRESS,
      userServiceUrl: process.env.USER_SERVICE_URL,
      chainServiceUrl: process.env.CHAIN_SERVICE_URL,
      contractServiceUrl: process.env.CONTRACT_SERVICE_URL,
      moonPayApiKey: process.env.MOONPAY_API_KEY,
      minGasWei: process.env.MIN_GAS_WEI || '5',
      maxGasPriceGwei: process.env.MAX_GAS_PRICE_GWEI || '0.001',
      maxGasCostGwei: process.env.MAX_GAS_COST_GWEI || '0.15',
      usdcGrantFoundryGas: process.env.USDC_GRANT_FOUNDRY_GAS || '150000',
      depositFundsFoundryGas: process.env.DEPOSIT_FUNDS_FOUNDRY_GAS || '150000',
      gasPriceBuffer: process.env.GAS_PRICE_BUFFER || '1',
      basePath,
      explorerBaseUrl: process.env.EXPLORER_BASE_URL,
      serviceLink: process.env.SERVICE_LINK || 'http://localhost:3000',
      neynarApiKey: process.env.NEYNAR_API_KEY,
      walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID,
      tokenSymbol: primaryToken?.symbol || 'USDC', // Primary token symbol from blockchain
      defaultTokenSymbol: process.env.DEFAULT_TOKEN_SYMBOL || 'USDC',
      // Token details from blockchain
      usdcDetails: usdcDetails,
      usdtDetails: usdtDetails,
      primaryToken: primaryToken,
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