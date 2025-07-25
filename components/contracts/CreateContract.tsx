import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { Web3Service } from '@/lib/web3';
import { isValidWalletAddress, isValidAmount, isValidExpiryTime, isValidDescription } from '@/utils/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CreateContractForm {
  sellerAddress: string;
  amount: string;
  hours: number;
  minutes: number;
  description: string;
}

interface FormErrors {
  sellerAddress?: string;
  amount?: string;
  expiry?: string;
  description?: string;
}

export default function CreateContract() {
  const router = useRouter();
  const { config } = useConfig();
  const [form, setForm] = useState<CreateContractForm>({
    sellerAddress: '',
    amount: '',
    hours: 24,
    minutes: 0,
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isValidWalletAddress(form.sellerAddress)) {
      newErrors.sellerAddress = 'Invalid wallet address';
    }

    if (!isValidAmount(form.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    if (!isValidExpiryTime(form.hours, form.minutes)) {
      newErrors.expiry = 'Expiry must be between 1 minute and 1 year';
    }

    if (!isValidDescription(form.description)) {
      newErrors.description = 'Description must be 1-160 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !config) return;

    setIsLoading(true);
    
    try {
      // Get Web3Auth provider
      setLoadingMessage('Initializing Web3...');
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      // Validate config before proceeding
      if (!config.usdcContractAddress) {
        throw new Error('USDC contract address not configured. Please check server configuration.');
      }

      console.log('Config received:', config);

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      // Check USDC balance
      setLoadingMessage('Checking USDC balance...');
      const balance = await web3Service.getUSDCBalance(userAddress);
      const amountUsdc = parseFloat(form.amount);
      if (parseFloat(balance) < amountUsdc) {
        throw new Error(`Insufficient USDC balance. You have ${balance} USDC`);
      }

      // Create contract via Chain Service
      setLoadingMessage('Creating secure escrow...');
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (form.hours * 3600) + (form.minutes * 60);
      
      // Convert amount to wei (USDC has 6 decimals)
      const amountWei = Math.floor(amountUsdc * 1000000);

      const response = await fetch(`${router.basePath}/api/chain/create-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buyer: userAddress,
          seller: form.sellerAddress,
          amount: amountWei,
          expiryTimestamp,
          description: form.description
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contract');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Contract creation failed');
      }

      const contractAddress = result.contractAddress;
      if (!contractAddress) {
        throw new Error('Contract address not returned from chain service');
      }

      // Now fund the contract
      setLoadingMessage('Depositing funds to escrow...');
      const depositTx = await web3Service.signDepositTransaction(contractAddress);

      // Send deposit transaction to chain service
      const depositResponse = await fetch(`${router.basePath}/api/chain/deposit-funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          signedTransaction: depositTx
        })
      });

      if (!depositResponse.ok) {
        const errorData = await depositResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fund deposit failed');
      }

      const depositResult = await depositResponse.json();
      if (!depositResult.success) {
        throw new Error(depositResult.error || 'Fund deposit failed');
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Contract creation failed:', error);
      alert(error.message || 'Failed to create contract');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Escrow Contract</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Seller Wallet Address"
          value={form.sellerAddress}
          onChange={(e) => setForm(prev => ({ ...prev, sellerAddress: e.target.value }))}
          placeholder="0x..."
          error={errors.sellerAddress}
          disabled={isLoading}
        />

        <Input
          label="Amount (USDC)"
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
          placeholder="100.00"
          error={errors.amount}
          disabled={isLoading}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Time
          </label>
          <div className="flex space-x-2">
            <Input
              type="number"
              min="0"
              value={form.hours}
              onChange={(e) => setForm(prev => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
              placeholder="Hours"
              disabled={isLoading}
            />
            <Input
              type="number"
              min="0"
              max="59"
              value={form.minutes}
              onChange={(e) => setForm(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
              placeholder="Minutes"
              disabled={isLoading}
            />
          </div>
          {errors.expiry && <p className="text-sm text-red-600 mt-1">{errors.expiry}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description ({form.description.length}/160)
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            maxLength={160}
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the escrow agreement..."
            disabled={isLoading}
          />
          {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-500 hover:bg-primary-600"
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              {loadingMessage}
            </>
          ) : (
            'Create Contract'
          )}
        </Button>
      </form>
    </div>
  );
}