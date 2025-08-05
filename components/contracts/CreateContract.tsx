import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { Web3Service } from '@/lib/web3';
import { isValidEmail, isValidAmount, isValidDescription, toMicroUSDC } from '@/utils/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CreateContractForm {
  buyerEmail: string;
  amount: string;
  payoutDateTime: string;
  description: string;
}

interface FormErrors {
  buyerEmail?: string;
  amount?: string;
  expiry?: string;
  description?: string;
}

export default function CreateContract() {
  const router = useRouter();
  const { config } = useConfig();
  const { user } = useAuth();
  // Initialize with tomorrow's date at current time
  const getDefaultDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    return tomorrow.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
    amount: '',
    payoutDateTime: getDefaultDateTime(),
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Calculate relative time from now
  const getRelativeTime = (dateTime: string): string => {
    const selected = new Date(dateTime);
    const now = new Date();
    const diffMs = selected.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'in the past';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
    
    const diffMonths = Math.floor(diffDays / 30);
    return `in ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isValidEmail(form.buyerEmail)) {
      newErrors.buyerEmail = 'Invalid email address';
    }

    if (!isValidAmount(form.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    // Validate payout date/time
    const payoutDate = new Date(form.payoutDateTime);
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (isNaN(payoutDate.getTime())) {
      newErrors.expiry = 'Please select a valid date and time';
    } else if (payoutDate <= now) {
      newErrors.expiry = 'Payout time must be in the future';
    } else if (payoutDate > oneYearFromNow) {
      newErrors.expiry = 'Payout time must be within 1 year';
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


      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      // Create pending contract via Contract Service (no USDC balance check needed)
      setLoadingMessage('Creating pending contract...');
      const payoutDate = new Date(form.payoutDateTime);
      const expiryTimestamp = Math.floor(payoutDate.getTime() / 1000);
      
      const pendingContractRequest = {
        buyerEmail: form.buyerEmail,
        sellerEmail: user?.email || '', // Get from authenticated user
        sellerAddress: userAddress,
        amount: toMicroUSDC(form.amount.trim()), // Convert to microUSDC format
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp,
        serviceLink: config.serviceLink
      };

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingContractRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contract');
      }

      const result = await response.json();

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
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Request payment from (email):"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => setForm(prev => ({ ...prev, buyerEmail: e.target.value }))}
          placeholder="payer@example.com"
          error={errors.buyerEmail}
          disabled={isLoading}
        />

        <div>
          <Input
            label="Amount (USDC)"
            type="number"
            step="0.001"
            min="0"
            value={form.amount}
            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="100.00"
            error={errors.amount}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">(includes $1 fee, amount must be over $1, or exactly 0.001 for your testing)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payout Date & Time
          </label>
          <input
            type="datetime-local"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={form.payoutDateTime}
            onChange={(e) => setForm(prev => ({ ...prev, payoutDateTime: e.target.value }))}
            min={new Date().toISOString().slice(0, 16)}
            max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
            disabled={isLoading}
          />
          {errors.expiry && <p className="text-sm text-red-600 mt-1">{errors.expiry}</p>}
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              Select when the funds should be released to you
            </p>
            {form.payoutDateTime && !errors.expiry && (
              <p className="text-xs font-medium text-primary-600">
                {getRelativeTime(form.payoutDateTime)}
              </p>
            )}
          </div>
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
            'Request from Buyer'
          )}
        </Button>
      </form>
    </div>
  );
}