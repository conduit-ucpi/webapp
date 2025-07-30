import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';

interface USDCGuideProps {
  showMoonPayComingSoon?: boolean;
}

export default function USDCGuide({ showMoonPayComingSoon = false }: USDCGuideProps) {
  const { user } = useAuth();
  const { config } = useConfig();

  if (!user || !config) return null;

  const getNetworkName = () => {
    switch (config.chainId) {
      case 43114:
        return 'Avalanche C-Chain';
      case 43113:
        return 'Avalanche Fuji Testnet';
      default:
        return 'Avalanche Network';
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Add USDC to Your Wallet/How to get cash from your Wallet</h3>
      <div className="space-y-3 text-sm text-blue-800">
        <div className="flex items-start">
          <span className="font-semibold mr-2">1.</span>
          <div>
            <span className="font-semibold">Check your network:</span> You're currently on {getNetworkName()}. 
            Make sure to deposit USDC on the same network.
          </div>
        </div>
        <div className="flex items-start">
          <span className="font-semibold mr-2">2.</span>
          <div>
            <span className="font-semibold">Your wallet address:</span> 
            <code className="bg-blue-100 px-2 py-1 rounded text-xs ml-2 break-all">{user.walletAddress}</code>
          </div>
        </div>
        <div className="flex items-start">
          <span className="font-semibold mr-2">3.</span>
          <div>
            <span className="font-semibold">Fund your wallet using:</span>
            <ul className="mt-2 ml-4 space-y-1">
              <li>• <strong>MoonPay:</strong> Buy/Sell USDC directly with credit/debit card{showMoonPayComingSoon ? ' (coming soon)' : ''}</li>
              <li>• <strong>MetaMask/Coinbase:</strong> Transfer USDC to/from another wallet</li>
              <li>• <strong>Major Exchanges:</strong> 
                <a href="https://www.binance.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Binance</a>,
                <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Coinbase</a>,
                <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Kraken</a>,
                <a href="https://crypto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Crypto.com</a>,
                <a href="https://easycrypto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Easy Crypto</a>
              </li>
              <li>• <strong>Cash Conversion:</strong> Use exchanges above to convert USDC to fiat currency</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-xs">
            <strong>Important:</strong> Ensure you're depositing USDC (not USDT or other stablecoins) on the {getNetworkName()} network. 
            Wrong network deposits may result in lost funds.
          </p>
        </div>
      </div>
    </div>
  );
}
