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

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
}