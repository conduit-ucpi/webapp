import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { getNetworkName } from '@/utils/networkUtils';
import { formatWalletAddress } from '@/utils/validation';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import Button from '@/components/ui/Button';
import { ethers } from 'ethers';

// ERC20 ABI for token balance
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

interface WalletInfoProps {
  className?: string;
  tokenSymbol?: string; // Optional: Override token symbol (defaults to config.tokenSymbol or 'USDC')
  tokenAddress?: string; // Optional: Override token contract address (defaults to config.usdcContractAddress)
}

export default function WalletInfo({
  className = '',
  tokenSymbol,
  tokenAddress
}: WalletInfoProps) {
  const { user } = useAuth();
  const { config } = useConfig();
  const { getUSDCBalance } = useSimpleEthers();
  const [balance, setBalance] = useState<string>('0.0000');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use provided token symbol/address or fall back to config
  const displayTokenSymbol = tokenSymbol || config?.tokenSymbol || 'USDC';
  const effectiveTokenAddress = tokenAddress || config?.usdcContractAddress;

  // Fetch token balance using ethers directly
  useEffect(() => {
    if (user?.walletAddress && effectiveTokenAddress && config?.rpcUrl) {
      setIsLoadingBalance(true);

      const fetchBalance = async () => {
        try {
          // Create provider and token contract
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const tokenContract = new ethers.Contract(
            effectiveTokenAddress,
            ERC20_ABI,
            provider
          );

          // Fetch balance and decimals
          const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(user.walletAddress),
            tokenContract.decimals()
          ]);

          // Format balance with proper decimals
          const formattedBalance = ethers.formatUnits(balance, decimals);
          const balanceNumber = parseFloat(formattedBalance);
          setBalance(balanceNumber.toFixed(4));
        } catch (error) {
          console.error(`Failed to fetch ${displayTokenSymbol} balance:`, error);
          setBalance('Error');
        } finally {
          setIsLoadingBalance(false);
        }
      };

      fetchBalance();
    }
  }, [user?.walletAddress, effectiveTokenAddress, config?.rpcUrl, displayTokenSymbol]);

  const copyToClipboard = async () => {
    if (!user?.walletAddress) return;
    
    try {
      // Use fallback method first since clipboard API may be blocked in iframe
      const textArea = document.createElement('textarea');
      textArea.value = user.walletAddress;
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
        await navigator.clipboard.writeText(user.walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      
      throw new Error('Both copy methods failed');
    } catch (error) {
      console.error('Failed to copy address:', error);
      alert('Could not copy address. Please copy manually: ' + user.walletAddress);
    }
  };

  if (!user?.walletAddress || !config) {
    return null;
  }

  const networkName = getNetworkName(config.chainId);

  return (
    <div className={`bg-secondary-50 rounded-lg p-4 border border-secondary-200 ${className}`}>
      <h3 className="text-sm font-medium text-secondary-900 mb-3">Wallet Information</h3>
      
      <div className="space-y-3">
        {/* Wallet Address */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-600">Wallet Address:</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-secondary-900">
                {formatWalletAddress(user.walletAddress)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="text-xs py-1 px-2 h-auto relative z-10 cursor-pointer"
                disabled={copied}
                type="button"
                title={copied ? 'Address copied!' : 'Click to copy wallet address'}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Token Balance */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-600">{displayTokenSymbol} Balance:</span>
            <span className="text-xs font-medium text-secondary-900">
              {isLoadingBalance ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                `${balance} ${displayTokenSymbol}`
              )}
            </span>
          </div>
        </div>

        {/* Network */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-600">Network:</span>
            <span className="text-xs font-medium text-secondary-900">
              {networkName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}