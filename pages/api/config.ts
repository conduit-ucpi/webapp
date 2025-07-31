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
    console.log('RPC_URL:', process.env.RPC_URL ? 'Present' : 'Missing');
    console.log('USDC_CONTRACT_ADDRESS:', process.env.USDC_CONTRACT_ADDRESS);
    console.log('MOONPAY_API_KEY:', process.env.MOONPAY_API_KEY ? 'Present' : 'Missing');
    console.log('MIN_GAS_WEI:', process.env.MIN_GAS_WEI);
    console.log('SNOWTRACE_BASE_URL:', process.env.SNOWTRACE_BASE_URL);

    const config = {
      web3AuthClientId: process.env.WEB3AUTH_CLIENT_ID,
      web3AuthNetwork: process.env.WEB3AUTH_NETWORK || 'sapphire_devnet',
      chainId: parseInt(process.env.CHAIN_ID || '43113'),
      rpcUrl: process.env.RPC_URL,
      usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS,
      moonPayApiKey: process.env.MOONPAY_API_KEY,
      minGasWei: process.env.MIN_GAS_WEI || '5',
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/webapp',
      snowtraceBaseUrl: process.env.SNOWTRACE_BASE_URL
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