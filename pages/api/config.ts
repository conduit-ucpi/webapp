import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Debug logging
    console.log('Environment variables check:');
    console.log('NEXT_PUBLIC_BASE_PATH:', process.env.NEXT_PUBLIC_BASE_PATH);
    console.log('WEB3AUTH_CLIENT_ID:', process.env.WEB3AUTH_CLIENT_ID ? 'Present' : 'Missing');
    console.log('CHAIN_ID:', process.env.CHAIN_ID);
    console.log('RPC_URL:', process.env.RPC_URL || 'MISSING - THIS WILL CAUSE ERRORS');
    console.log('RPC_URL raw bytes:', process.env.RPC_URL ? Array.from(process.env.RPC_URL).map(c => c.charCodeAt(0)) : 'N/A');
    console.log('RPC_URL trimmed:', process.env.RPC_URL?.trim());
    console.log('RPC_URL trimmed bytes:', process.env.RPC_URL?.trim() ? Array.from(process.env.RPC_URL.trim()).map(c => c.charCodeAt(0)) : 'N/A');
    console.log('USDC_CONTRACT_ADDRESS:', process.env.USDC_CONTRACT_ADDRESS);
    console.log('MOONPAY_API_KEY:', process.env.MOONPAY_API_KEY ? 'Present' : 'Missing');
    console.log('MIN_GAS_WEI:', process.env.MIN_GAS_WEI);
    console.log('MAX_GAS_PRICE_GWEI:', process.env.MAX_GAS_PRICE_GWEI);
    console.log('EXPLORER_BASE_URL:', process.env.EXPLORER_BASE_URL);
    console.log('SERVICE_LINK:', process.env.SERVICE_LINK);
    console.log('CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
    console.log('WALLETCONNECT_PROJECT_ID:', process.env.WALLETCONNECT_PROJECT_ID ? 'Present' : 'Missing');

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH === 'null' ? '' : (process.env.NEXT_PUBLIC_BASE_PATH || '/webapp');
    
    // Validate critical configuration
    if (!process.env.RPC_URL) {
      throw new Error('RPC_URL environment variable is required but not set');
    }
    if (!process.env.WEB3AUTH_CLIENT_ID) {
      throw new Error('WEB3AUTH_CLIENT_ID environment variable is required but not set');
    }
    
    const config = {
      web3AuthClientId: process.env.WEB3AUTH_CLIENT_ID,
      web3AuthNetwork: process.env.WEB3AUTH_NETWORK || 'sapphire_devnet',
      chainId: parseInt(process.env.CHAIN_ID || '43113'),
      rpcUrl: process.env.RPC_URL?.trim(),
      usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS,
      contractAddress: process.env.CONTRACT_ADDRESS,
      contractFactoryAddress: process.env.CONTRACT_FACTORY_ADDRESS,
      userServiceUrl: process.env.USER_SERVICE_URL,
      chainServiceUrl: process.env.CHAIN_SERVICE_URL,
      contractServiceUrl: process.env.CONTRACT_SERVICE_URL,
      moonPayApiKey: process.env.MOONPAY_API_KEY,
      minGasWei: process.env.MIN_GAS_WEI || '5',
      maxGasPriceGwei: process.env.MAX_GAS_PRICE_GWEI || '0.001',
      basePath,
      explorerBaseUrl: process.env.EXPLORER_BASE_URL,
      serviceLink: process.env.SERVICE_LINK || 'http://localhost:3000',
      neynarApiKey: process.env.NEYNAR_API_KEY,
      walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID,
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

    if (!config.usdcContractAddress) {
      console.error('USDC_CONTRACT_ADDRESS is missing or null');
      return res.status(500).json({ error: 'USDC contract address not configured' });
    }

    console.log('Config being sent:', config);
    res.status(200).json(config);
  } catch (error) {
    console.error('Config loading error:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
}