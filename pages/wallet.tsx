import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';
import { Web3Service } from '@/lib/web3';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { ethers } from 'ethers';

interface WalletBalances {
  avax: string;
  usdc: string;
}

interface SendFormData {
  recipient: string;
  amount: string;
  currency: 'AVAX' | 'USDC';
}

export default function Wallet() {
  const { user, provider, isLoading: authLoading } = useAuth();
  const { config } = useConfig();
  const [balances, setBalances] = useState<WalletBalances>({ avax: '0', usdc: '0' });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [sendForm, setSendForm] = useState<SendFormData>({
    recipient: '',
    amount: '',
    currency: 'USDC'
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadBalances = async () => {
    if (!user || !config || !provider) return;

    setIsLoadingBalances(true);
    try {
      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(provider);

      // Get AVAX balance
      const ethersProvider = new ethers.BrowserProvider(provider);
      const avaxBalance = await ethersProvider.getBalance(user.walletAddress);
      const avaxFormatted = ethers.formatEther(avaxBalance);

      // Get USDC balance
      const usdcBalance = await web3Service.getUSDCBalance(user.walletAddress);

      setBalances({
        avax: parseFloat(avaxFormatted).toFixed(6),
        usdc: parseFloat(usdcBalance).toFixed(2)
      });
    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [user, config, provider]);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !config || !provider) {
      setSendError('Web3Auth provider not available. Please reconnect your wallet.');
      return;
    }

    setSendError(null);
    setSendSuccess(null);
    setIsSending(true);

    try {
      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(provider);
      const signer = await web3Service.getSigner();

      if (sendForm.currency === 'AVAX') {
        // Send AVAX
        const tx = await signer.sendTransaction({
          to: sendForm.recipient,
          value: ethers.parseEther(sendForm.amount),
          gasLimit: '21000'
        });
        setSendSuccess(`AVAX sent successfully! Transaction: ${tx.hash}`);
      } else {
        // Send USDC
        const usdcContract = new ethers.Contract(
          config.usdcContractAddress,
          ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)'],
          signer
        );
        const decimals = await usdcContract.decimals();
        const amount = ethers.parseUnits(sendForm.amount, decimals);
        const tx = await usdcContract.transfer(sendForm.recipient, amount);
        setSendSuccess(`USDC sent successfully! Transaction: ${tx.hash}`);
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

  const isValidAmount = (amount: string, currency: 'AVAX' | 'USDC') => {
    const num = parseFloat(amount);
    const maxBalance = currency === 'AVAX' ? parseFloat(balances.avax) : parseFloat(balances.usdc);
    return !isNaN(num) && num > 0 && num <= maxBalance;
  };

  const canSubmit = () => {
    return (
      isValidAddress(sendForm.recipient) &&
      isValidAmount(sendForm.amount, sendForm.currency) &&
      !isSending
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !provider) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to manage your funds.
        </p>
        <ConnectWallet />
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
                <ExpandableHash hash={user.walletAddress} />
              </div>
            </div>
            <Button
              onClick={loadBalances}
              disabled={isLoadingBalances}
              variant="outline"
              size="sm"
            >
              {isLoadingBalances ? 'Refreshing...' : 'Refresh Balances'}
            </Button>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">AVAX Balance</p>
                  <div className="flex items-center">
                    {isLoadingBalances ? (
                      <div className="w-16 h-6 bg-red-200 animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-red-900">{balances.avax}</p>
                    )}
                    <span className="ml-2 text-sm text-red-700">AVAX</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                  <span className="text-red-800 font-bold text-sm">A</span>
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
                    value="AVAX"
                    checked={sendForm.currency === 'AVAX'}
                    onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value as 'AVAX' | 'USDC' }))}
                    className="mr-2"
                  />
                  AVAX
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="currency"
                    value="USDC"
                    checked={sendForm.currency === 'USDC'}
                    onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value as 'AVAX' | 'USDC' }))}
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
                Available: {sendForm.currency === 'AVAX' ? balances.avax : balances.usdc} {sendForm.currency}
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