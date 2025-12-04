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
            <div className="flex items-center gap-1">
              <span className="font-semibold">Your wallet address:</span>
              <button
                onClick={copyToClipboard}
                className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                title={copied ? 'Address copied!' : 'Click to copy wallet address'}
                aria-label={copied ? 'Address copied' : 'Copy wallet address'}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            <code className="bg-blue-100 px-2 py-1 rounded text-xs whitespace-nowrap block mt-1 overflow-x-auto">{walletAddress}</code>
          </div>
        </div>
        <div className="flex items-start">
          <span className="font-semibold mr-2">3.</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold">Fund your wallet using:</span>
            <ul className="mt-2 ml-4 space-y-1 break-words">
              <li>• <strong>MetaMask/Coinbase:</strong> Transfer {tokenSymbol} to/from another wallet</li>
              <li>• <strong>Major Exchanges:</strong>{' '}
                <a href="https://www.coinbase.com/price/usdc" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Coinbase</a>,{' '}
                <a href="https://www.binance.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Binance</a>,{' '}
                <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Kraken</a>,{' '}
                <a href="https://crypto.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline mx-1">Crypto.com</a>,{' '}
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
