import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BuyerInput from '@/components/ui/BuyerInput';
import { isValidEmail, isValidDescription, isValidAmount, isValidBuyerIdentifier, toMicroUSDC } from '@/utils/validation';


interface CreateContractForm {
  buyerEmail: string;
  buyerType: 'email' | 'farcaster';
  amount: string;
  payoutTimestamp: number; // Unix timestamp in seconds
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
  const { user, authenticatedFetch } = useAuth();
  // Initialize with tomorrow's date at current time
  const getDefaultTimestamp = (): number => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Return Unix timestamp in seconds
    return Math.floor(tomorrow.getTime() / 1000);
  };

  // Convert Unix timestamp to datetime-local input format
  const timestampToDatetimeLocal = (timestamp: number): string => {
    // datetime-local expects YYYY-MM-DDTHH:MM format in LOCAL time (no timezone)
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert datetime-local input to Unix timestamp
  const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
    const date = new Date(datetimeLocal);
    return Math.floor(date.getTime() / 1000);
  };

  // Get current local time in datetime-local format
  const getCurrentLocalDatetime = (): string => {
    const now = Math.floor(Date.now() / 1000);
    return timestampToDatetimeLocal(now);
  };

  // Get max date (1 year from now) in datetime-local format  
  const getMaxLocalDatetime = (): string => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    return timestampToDatetimeLocal(Math.floor(oneYearFromNow.getTime() / 1000));
  };

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
    buyerType: 'email',
    amount: '',
    payoutTimestamp: getDefaultTimestamp(),
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Calculate relative time from now using Unix timestamp
  const getRelativeTime = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = timestamp - now;
    
    if (diffSeconds <= 0) return 'in the past';
    
    const diffMins = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffDays = Math.floor(diffSeconds / 86400);
    
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

    // Use local validation functions directly
    const amountValidator = isValidAmount;
    const descriptionValidator = isValidDescription;

    // Validate buyer identifier (email or Farcaster handle)
    const buyerValidation = isValidBuyerIdentifier(form.buyerEmail);
    if (!buyerValidation.isValid) {
      newErrors.buyerEmail = buyerValidation.error || 'Invalid buyer identifier';
    }

    if (!amountValidator(form.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    // Validate payout timestamp
    const now = Math.floor(Date.now() / 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60); // 1 year in seconds
    
    if (!form.payoutTimestamp || form.payoutTimestamp <= 0) {
      newErrors.expiry = 'Please select a valid date and time';
    } else if (form.payoutTimestamp <= now) {
      newErrors.expiry = 'Payout time must be in the future';
    } else if (form.payoutTimestamp > oneYearFromNow) {
      newErrors.expiry = 'Payout time must be within 1 year';
    }

    if (!descriptionValidator(form.description)) {
      newErrors.description = 'Description must be 1-160 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formValid = validateForm();
    
    if (!formValid || !config) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Validate config before proceeding
      if (!config.usdcContractAddress) {
        throw new Error('USDC contract address not configured. Please check server configuration.');
      }
      
      // Check if user is authenticated and has wallet address
      setLoadingMessage('Initializing...');
      
      if (!user?.walletAddress) {
        console.error('🔧 CreateContract: No wallet address found in user object');
        throw new Error('Please connect your wallet first.');
      }
      
      // Use the wallet address from the authenticated user directly
      const userAddress = user.walletAddress;

      // Create pending contract via Contract Service (no USDC balance check needed)
      setLoadingMessage('Creating pending contract...');
      
      
      const pendingContractRequest = {
        buyerEmail: form.buyerType === 'email' ? form.buyerEmail : '',
        buyerFarcasterHandle: form.buyerType === 'farcaster' ? form.buyerEmail : '',
        sellerEmail: user?.email || '', // Get from authenticated user
        sellerAddress: userAddress,
        amount: toMicroUSDC(parseFloat(form.amount.trim())), // Convert to microUSDC format
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp: form.payoutTimestamp, // Already a Unix timestamp in seconds
        serviceLink: config.serviceLink
      };

      
      if (!authenticatedFetch) {
        throw new Error('authenticatedFetch is not available');
      }
      
      const response = await authenticatedFetch('/api/contracts', {
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
        <BuyerInput
          label="Request payment from buyer:"
          value={form.buyerEmail}
          onChange={(value, type) => setForm(prev => ({ 
            ...prev, 
            buyerEmail: value,
            buyerType: type
          }))}
          error={errors.buyerEmail}
          placeholder="Search Farcaster user or enter email"
          helpText="You can search for Farcaster users or enter an email address"
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
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Your local time)
            </span>
          </label>
          <input
            type="datetime-local"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={timestampToDatetimeLocal(form.payoutTimestamp)}
            onChange={(e) => setForm(prev => ({ 
              ...prev, 
              payoutTimestamp: datetimeLocalToTimestamp(e.target.value) 
            }))}
            min={getCurrentLocalDatetime()}
            max={getMaxLocalDatetime()}
            disabled={isLoading}
          />
          {errors.expiry && <p className="text-sm text-red-600 mt-1">{errors.expiry}</p>}
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              Funds will be released at this time (your local timezone)
            </p>
            {form.payoutTimestamp && !errors.expiry && (
              <p className="text-xs font-medium text-primary-600">
                {getRelativeTime(form.payoutTimestamp)}
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
            'Request Payment from Buyer'
          )}
        </Button>
      </form>
    </div>
  );
}