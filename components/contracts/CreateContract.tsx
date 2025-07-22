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
      const web3authProvider = (window as any).web3auth?.provider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);

      const signer = await web3Service.getSigner();
      const userAddress = await signer.getAddress();

      // Check USDC balance
      setLoadingMessage('Checking USDC balance...');
      const balance = await web3Service.getUSDCBalance(userAddress);
      if (parseFloat(balance) < parseFloat(form.amount)) {
        throw new Error(`Insufficient USDC balance. You have ${balance} USDC`);
      }

      // Check and request allowance if needed
      setLoadingMessage('Checking USDC allowance...');
      const allowance = await web3Service.getUSDCAllowance(userAddress);
      if (parseFloat(allowance) < parseFloat(form.amount)) {
        setLoadingMessage('Requesting USDC approval...');
        await web3Service.approveUSDC(form.amount);
      }

      // Create contract transaction
      setLoadingMessage('Creating secure escrow...');
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (form.hours * 3600) + (form.minutes * 60);
      const signedTx = await web3Service.createContractTransaction(
        form.sellerAddress,
        form.amount,
        expiryTimestamp,
        form.description
      );

      // Send to backend
      const response = await fetch('/api/chain/create-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sellerAddress: form.sellerAddress,
          amount: form.amount,
          expiryTimestamp,
          description: form.description,
          signedTransaction: signedTx
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create contract');
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