import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { getChainName } from '@/utils/chainNames';

export default function TokenGuide() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { walletAddress } = useWalletAddress();
  const [copied, setCopied] = useState(false);

  if (!user || !config) return null;

  const getNetworkName = () => {
    return getChainName(config.chainId);
  };

  const tokenSymbol = config.tokenSymbol || 'USDC';

  const copyToClipboard = async () => {
    if (!walletAddress) return;

    try {
      // Use fallback method first since clipboard API may be blocked in iframe
      const textArea = document.createElement('textarea');
      textArea.value = walletAddress;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999); // For mobile devices

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      // If fallback fails, try modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      throw new Error('Both copy methods failed');
    } catch (error) {
      console.error('Failed to copy address:', error);
      alert('Could not copy address. Please copy manually: ' + walletAddress);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Add {tokenSymbol} to Your Wallet/How to get cash from your Wallet</h3>
      <div className="space-y-3 text-sm text-blue-800">
        <div className="flex items-start">
          <span className="font-semibold mr-2">1.</span>
          <div>
            <span className="font-semibold">Check your network:</span> You're currently on {getNetworkName()}.
            Make sure to deposit {tokenSymbol} on the same network.
          </div>
        </div>
        <div className="flex items-start">
          <span className="font-semibold mr-2">2.</span>
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-semibold">Your wallet address:</span>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs break-all flex-1 min-w-0">{walletAddress}</code>
              <button
                onClick={copyToClipboard}
                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title={copied ? 'Address copied!' : 'Click to copy wallet address'}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-start">
          <span className="font-semibold mr-2">3.</span>
          <div>
            <span className="font-semibold">Fund your wallet using:</span>
            <ul className="mt-2 ml-4 space-y-1">
              <li>• <strong>MetaMask/Coinbase:</strong> Transfer {tokenSymbol} to/from another wallet</li>
              <li>• <strong>Major Exchanges:</strong>
                <a href="https://www.coinbase.com/price/usdc" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Coinbase</a>,
                <a href="https://www.binance.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Binance</a>,
                <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Kraken</a>,
                <a href="https://crypto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Crypto.com</a>,
                <a href="https://easycrypto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">EasyCrypto</a>
              </li>
              <li>• <strong>Cash Conversion:</strong> Use the exchanges above to convert {tokenSymbol} to fiat currency</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-xs">
            <strong>Important:</strong> Ensure you're depositing {tokenSymbol} (not other tokens) on the {getNetworkName()} network.
            Wrong network deposits may result in lost funds.
          </p>
        </div>
      </div>
    </div>
  );
}
