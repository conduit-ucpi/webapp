import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { getNetworkName } from '@/utils/networkUtils';
import { formatWalletAddress } from '@/utils/validation';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import Button from '@/components/ui/Button';

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
  const { user, address } = useAuth(); // Get address for lazy auth support
  const { config } = useConfig();
  const { getTokenBalance } = useSimpleEthers();
  const [balance, setBalance] = useState<string>('0.0000');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use provided token symbol/address or fall back to config
  // Memoized to prevent unnecessary re-calculations
  const displayTokenSymbol = useMemo(
    () => tokenSymbol || config?.tokenSymbol || 'USDC',
    [tokenSymbol, config?.tokenSymbol]
  );

  const effectiveTokenAddress = useMemo(
    () => tokenAddress || config?.defaultToken?.address || config?.usdcContractAddress,
    [tokenAddress, config?.defaultToken?.address, config?.usdcContractAddress]
  );

  // Debug logging (only when token selection actually changes)
  useEffect(() => {
    console.log('🔧 WalletInfo: Token selection', {
      propTokenSymbol: tokenSymbol,
      propTokenAddress: tokenAddress,
      displayTokenSymbol,
      effectiveTokenAddress,
      configUsdcDetails: config?.usdcDetails,
      configUsdtDetails: config?.usdtDetails
    });
  }, [tokenSymbol, tokenAddress, displayTokenSymbol, effectiveTokenAddress, config?.usdcDetails, config?.usdtDetails]);

  // Fetch token balance via the read-only RPC library (RpcClient, through
  // useSimpleEthers -> Web3Service). No direct provider instantiation here.
  // Use address instead of user?.walletAddress for lazy auth support
  useEffect(() => {
    if (address && effectiveTokenAddress && config?.rpcUrl) {
      setIsLoadingBalance(true);

      const fetchBalance = async () => {
        try {
          const formattedBalance = await getTokenBalance(address, effectiveTokenAddress);
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
  }, [address, effectiveTokenAddress, config?.rpcUrl, displayTokenSymbol, getTokenBalance]);

  const copyToClipboard = async () => {
    if (!address) return;

    try {
      // Use fallback method first since clipboard API may be blocked in iframe
      const textArea = document.createElement('textarea');
      textArea.value = address;
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
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      throw new Error('Both copy methods failed');
    } catch (error) {
      console.error('Failed to copy address:', error);
      alert('Could not copy address. Please copy manually: ' + address);
    }
  };

  // Show component when wallet is connected (address exists), not when backend user exists
  if (!address || !config) {
    return null;
  }

  const networkName = getNetworkName(config.chainId);

  return (
    <div className={`bg-secondary-50 rounded-lg p-4 border border-secondary-200 ${className}`}>
      <h3 className="text-sm font-medium text-secondary-900 mb-3">YOUR wallet information</h3>

      <div className="space-y-3">
        {/* Wallet Address */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-600">Wallet Address:</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-secondary-900">
                {formatWalletAddress(address)}
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