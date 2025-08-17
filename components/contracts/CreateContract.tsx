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
  const { user } = useAuth();
  // Initialize with tomorrow's date at current time
  const getDefaultTimestamp = (): number => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Return Unix timestamp in seconds
    return Math.floor(tomorrow.getTime() / 1000);
  };

  const getUserTimezone = () => {
    // Get the timezone abbreviation (e.g., "EST", "PST", "GMT")
    const date = new Date();
    const timeString = date.toLocaleTimeString('en-US', { 
      timeZoneName: 'short' 
    });
    // Extract just the timezone part (last word)
    const parts = timeString.split(' ');
    return parts[parts.length - 1];
  };

  // Convert Unix timestamp to datetime-local input format (LOCAL time, not UTC!)
  const timestampToDatetimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    // Build local time string, NOT UTC
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
    const now = new Date();
    // Get local time components
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get max date (1 year from now) in datetime-local format
  const getMaxLocalDatetime = (): string => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const year = oneYearFromNow.getFullYear();
    const month = (oneYearFromNow.getMonth() + 1).toString().padStart(2, '0');
    const day = oneYearFromNow.getDate().toString().padStart(2, '0');
    const hours = oneYearFromNow.getHours().toString().padStart(2, '0');
    const minutes = oneYearFromNow.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
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

    if (!isValidEmail(form.buyerEmail)) {
      newErrors.buyerEmail = 'Invalid email address';
    }

    if (!isValidAmount(form.amount)) {
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
      
      // Get the actual user wallet address from Web3Auth
      const userAddress = await web3Service.getUserAddress();

      // Create pending contract via Contract Service (no USDC balance check needed)
      setLoadingMessage('Creating pending contract...');
      
      const pendingContractRequest = {
        buyerEmail: form.buyerEmail,
        sellerEmail: user?.email || '', // Get from authenticated user
        sellerAddress: userAddress,
        amount: toMicroUSDC(form.amount.trim()), // Convert to microUSDC format
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp: form.payoutTimestamp, // Already a Unix timestamp in seconds
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
          label="Request payment from buyer (email):"
          type="email"
          value={form.buyerEmail}
          onChange={(e) => setForm(prev => ({ ...prev, buyerEmail: e.target.value }))}
          placeholder="buyer@example.com"
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
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Your timezone: {getUserTimezone()})
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
              Funds will be released at this time in {getUserTimezone()}
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