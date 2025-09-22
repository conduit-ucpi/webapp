import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWeb3SDK } from '@/hooks/useWeb3SDK';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import USDCGuide from '@/components/ui/USDCGuide';
import { ethers } from 'ethers';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { TransferUSDCRequest } from '@/types';
import { ensureHexPrefix } from '@/utils/hexUtils';

interface WalletBalances {
  native: string;
  usdc: string;
}

interface ChainInfo {
  chainId: number;
  chainIdHex: string;
  name: string;
  blockNumber: number;
  gasPrice: string | null;
}

interface SendFormData {
  recipient: string;
  amount: string;
  currency: 'NATIVE' | 'USDC';
}

export default function Wallet() {
  const { user, isLoading: authLoading, getEthersProvider } = useAuth();
  const { isInFarcaster } = useFarcaster();
  const { config } = useConfig();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  const { getUSDCBalance, signUSDCTransfer, getUserAddress, isReady, error: sdkError } = useWeb3SDK();
  const [balances, setBalances] = useState<WalletBalances>({ native: '0.0000', usdc: '0.0000' });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [sendForm, setSendForm] = useState<SendFormData>({
    recipient: '',
    amount: '',
    currency: 'USDC'
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [isLoadingChainInfo, setIsLoadingChainInfo] = useState(false);

  const loadChainInfo = async () => {
    const ethersProvider = getEthersProvider();
    if (!ethersProvider) return;

    setIsLoadingChainInfo(true);
    try {

      // Get network info directly from ethers provider
      const network = await ethersProvider.getNetwork();
      const chainId = Number(network.chainId);

      // Get current block number
      const blockNumber = await ethersProvider.getBlockNumber();

      // Get current gas price using ethers (more reliable than manual RPC calls)
      let gasPrice: string | null = null;
      try {
        console.log('Loading chain info - fetching gas price with ethers...');
        const feeData = await ethersProvider.getFeeData();
        if (feeData.gasPrice) {
          gasPrice = ethers.formatUnits(feeData.gasPrice, 'gwei');
          console.log('Got gas price from ethers:', gasPrice, 'gwei');
        }
      } catch (error) {
        console.warn('Failed to get gas price from ethers:', error);
        gasPrice = null;
      }

      // Determine chain name based on chainId
      const chainNames: Record<number, string> = {
        // Ethereum
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia Testnet',
        
        // Avalanche
        43114: 'Avalanche C-Chain',
        43113: 'Avalanche Fuji Testnet',
        
        // Polygon
        137: 'Polygon Mainnet',
        80001: 'Mumbai Testnet',
        
        // Base
        8453: 'Base Mainnet',
        84532: 'Base Sepolia',
        
        // Arbitrum
        42161: 'Arbitrum One',
        421614: 'Arbitrum Sepolia',
        
        // Optimism
        10: 'Optimism Mainnet',
        11155420: 'Optimism Sepolia',
        
        // BSC
        56: 'BNB Smart Chain',
        97: 'BSC Testnet',
      };
      
      const name = chainNames[chainId] || `Chain ID: ${chainId}`;

      setChainInfo({
        chainId,
        chainIdHex: ensureHexPrefix(chainId.toString(16)),
        name,
        blockNumber,
        gasPrice
      });
    } catch (error) {
      console.error('Error loading chain info:', error);
    } finally {
      setIsLoadingChainInfo(false);
    }
  };

  const loadBalances = async () => {
    const ethersProvider = getEthersProvider();
    if (!user || !config || !ethersProvider || !isReady) {
      console.log('Skipping balance load:', { user: !!user, config: !!config, ethersProvider: !!ethersProvider, isReady });
      return;
    }

    setIsLoadingBalances(true);
    try {
      // Get the real wallet address from SDK
      const userAddress = await getUserAddress();
      console.log('Loading balances for address:', userAddress);
      
      // Get network info for debugging
      const network = await ethersProvider.getNetwork();
      console.log('Current network:', { 
        chainId: network.chainId.toString(), 
        name: network.name,
        ensAddress: network.ensAddress,
        full: network
      });
      
      const nativeBalance = await ethersProvider.getBalance(userAddress);
      const nativeFormatted = ethers.formatEther(nativeBalance);
      console.log('Native balance:', { raw: nativeBalance.toString(), formatted: nativeFormatted });

      // Get USDC balance using SDK
      const usdcBalance = await getUSDCBalance();
      console.log('USDC balance:', usdcBalance);

      // Format native balance with scientific notation for small values
      const nativeValue = parseFloat(nativeFormatted);
      let nativeDisplay: string;
      if (nativeValue < 0.0001 && nativeValue > 0) {
        // Use scientific notation for very small values
        // toExponential(3) gives us 4 significant figures (e.g., "1.234e-5")
        nativeDisplay = nativeValue.toExponential(3);
      } else {
        // Always show 4 decimal places for consistency
        nativeDisplay = nativeValue.toFixed(4);
      }

      // Parse and format USDC to always show 4 decimal places
      const usdcValue = parseFloat(usdcBalance);
      const usdcDisplay = usdcValue.toFixed(4);

      console.log('Final display values:', { native: nativeDisplay, usdc: usdcDisplay });

      setBalances({
        native: nativeDisplay,
        usdc: usdcDisplay
      });
    } catch (error) {
      console.error('Error loading balances - full error:', error);
      // Optionally show error to user
      setBalances({
        native: 'Error',
        usdc: 'Error'
      });
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    const ethersProvider = getEthersProvider();
    if (ethersProvider) {
      loadBalances();
      loadChainInfo();
    }
  }, [user, config, getEthersProvider, isReady]);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ethersProvider = getEthersProvider();
    if (!user || !config || !ethersProvider) {
      setSendError('Wallet provider not available. Please reconnect your wallet.');
      return;
    }

    setSendError(null);
    setSendSuccess(null);
    setIsSending(true);

    try {
      if (!isReady) {
        throw new Error('SDK not ready. Please ensure wallet is connected.');
      }

      if (sdkError) {
        throw new Error(`SDK error: ${sdkError}`);
      }

      if (sendForm.currency === 'NATIVE') {
        // Send native token
        const signer = await ethersProvider.getSigner();
        const tx = await signer.sendTransaction({
          to: sendForm.recipient,
          value: ethers.parseEther(sendForm.amount)
        });
        setSendSuccess(`Native token sent successfully! Transaction: ${tx.hash}`);
      } else {
        // Send USDC via chain-service using SDK
        const signedTx = await signUSDCTransfer(sendForm.recipient, sendForm.amount);

        // Get the user's wallet address from SDK
        const userAddress = await getUserAddress();

        // Submit signed transaction to chain service
        const transferRequest: TransferUSDCRequest = {
          recipientAddress: sendForm.recipient,
          amount: sendForm.amount,
          userWalletAddress: userAddress,
          signedTransaction: signedTx
        };

        const response = await fetch('/api/chain/transfer-usdc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transferRequest)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to transfer USDC');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Transfer failed');
        }

        setSendSuccess(`USDC sent successfully! Transaction: ${result.transactionHash}`);
      }

      // Reset form and reload balances
      setSendForm({ recipient: '', amount: '', currency: 'USDC' });
      setTimeout(loadBalances, 2000); // Reload after 2 seconds
    } catch (error: any) {
      console.error('Send error:', error);
      setSendError(error.message || 'Transaction failed');
    } finally {
      setIsSending(false);
    }
  };

  const isValidAddress = (address: string) => {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  };

  const isValidAmount = (amount: string, currency: 'NATIVE' | 'USDC') => {
    const num = parseFloat(amount);
    const maxBalance = currency === 'NATIVE' ? parseFloat(balances.native) : parseFloat(balances.usdc);
    return !isNaN(num) && num > 0 && num <= maxBalance;
  };

  const canSubmit = () => {
    return (
      isValidAddress(sendForm.recipient) &&
      isValidAmount(sendForm.amount, sendForm.currency) &&
      !isSending
    );
  };

  if (authLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // For now, wallet page is only available with Web3Auth
  if (!user || !walletAddress || isInFarcaster) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to manage your funds.
        </p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Wallet Management</h1>
          <p className="mt-2 text-gray-600">
            View your balances and send funds to other wallets
          </p>
        </div>

        {/* Wallet Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connected Wallet</h2>
              <div className="text-sm text-gray-600 mt-1">
                <ExpandableHash hash={walletAddress} />
              </div>
              {chainInfo && (
                <div className="mt-2 flex items-center space-x-4 text-sm">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                    <span className="font-medium text-gray-700">{chainInfo.name}</span>
                  </span>
                  <span className="text-gray-500">Block #{chainInfo.blockNumber.toLocaleString()}</span>
                  <span className="text-gray-500">Gas: {chainInfo.gasPrice ? `${parseFloat(chainInfo.gasPrice).toFixed(2)} Gwei` : 'Unavailable'}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col space-y-2">
              <Button
                onClick={() => { loadBalances(); loadChainInfo(); }}
                disabled={isLoadingBalances || isLoadingChainInfo}
                variant="outline"
                size="sm"
              >
                {(isLoadingBalances || isLoadingChainInfo) ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Native Token Balance</p>
                  <div className="flex items-center">
                    {isLoadingBalances ? (
                      <div className="w-16 h-6 bg-red-200 animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-red-900">{balances.native}</p>
                    )}
                    <span className="ml-2 text-sm text-red-700">{chainInfo?.name ? chainInfo.name.split(' ')[0] : 'Native'}</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                  <span className="text-red-800 font-bold text-sm">N</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">USDC Balance</p>
                  <div className="flex items-center">
                    {isLoadingBalances ? (
                      <div className="w-16 h-6 bg-blue-200 animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-blue-900">{balances.usdc}</p>
                    )}
                    <span className="ml-2 text-sm text-blue-700">USDC</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                  <span className="text-blue-800 font-bold text-sm">$</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Funding Guide */}
        <div className="mb-8">
          <USDCGuide />
        </div>

        {/* Send Funds */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Send Funds</h2>

          <form onSubmit={handleSendSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="currency"
                    value="NATIVE"
                    checked={sendForm.currency === 'NATIVE'}
                    onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value as 'NATIVE' | 'USDC' }))}
                    className="mr-2"
                  />
                  Native
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="currency"
                    value="USDC"
                    checked={sendForm.currency === 'USDC'}
                    onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value as 'NATIVE' | 'USDC' }))}
                    className="mr-2"
                  />
                  USDC
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Address
              </label>
              <Input
                id="recipient"
                type="text"
                value={sendForm.recipient}
                onChange={(e) => setSendForm(prev => ({ ...prev, recipient: e.target.value }))}
                placeholder="0x..."
                className={sendForm.recipient && !isValidAddress(sendForm.recipient) ? 'border-red-300' : ''}
              />
              {sendForm.recipient && !isValidAddress(sendForm.recipient) && (
                <p className="text-sm text-red-600 mt-1">Invalid address format</p>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className={sendForm.amount && !isValidAmount(sendForm.amount, sendForm.currency) ? 'border-red-300' : ''}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">{sendForm.currency}</span>
                </div>
              </div>
              {sendForm.amount && !isValidAmount(sendForm.amount, sendForm.currency) && (
                <p className="text-sm text-red-600 mt-1">
                  Amount must be greater than 0 and not exceed your balance
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Available: {sendForm.currency === 'NATIVE' ? balances.native : balances.usdc} {sendForm.currency === 'NATIVE' ? 'Native' : 'USDC'}
              </p>
            </div>

            {sendError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{sendError}</p>
              </div>
            )}

            {sendSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-600">{sendSuccess}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit()}
              className="w-full"
            >
              {isSending ? 'Sending...' : `Send ${sendForm.currency}`}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}