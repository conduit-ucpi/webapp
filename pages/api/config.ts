import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = {
      web3AuthClientId: process.env.WEB3AUTH_CLIENT_ID,
      chainId: parseInt(process.env.CHAIN_ID || '43113'),
      rpcUrl: process.env.RPC_URL,
      usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS,
      contractFactoryAddress: process.env.CONTRACT_FACTORY_ADDRESS,
      moonPayApiKey: process.env.MOONPAY_API_KEY
    };

    // Add validation to catch missing required values
    if (!config.contractFactoryAddress || config.contractFactoryAddress === 'your_contract_factory_address_here') {
      console.error('CONTRACT_FACTORY_ADDRESS is missing or contains placeholder value:', config.contractFactoryAddress);
      return res.status(500).json({ error: 'Contract factory address not configured' });
    }

    if (!config.usdcContractAddress) {
      console.error('USDC_CONTRACT_ADDRESS is missing');
      return res.status(500).json({ error: 'USDC contract address not configured' });
    }

    res.status(200).json(config);
  } catch (error) {
    console.error('Config loading error:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
}