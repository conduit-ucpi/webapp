import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import {
  toMicroUSDC,
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp,
  getDefaultTimestamp,
  getCurrentLocalDatetime,
  getMaxLocalDatetime,
  getRelativeTime
} from '@/utils/validation';
import { useCreateContractValidation } from './useContractValidation';

interface CreateContractForm {
  buyerEmail: string;
  buyerType: 'email' | 'farcaster';
  amount: string;
  payoutTimestamp: number;
  description: string;
}

export function useCreateContract() {
  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch } = useAuth();
  const { errors, validateForm, clearErrors } = useCreateContractValidation();

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
    buyerType: 'email',
    amount: '',
    payoutTimestamp: getDefaultTimestamp(),
    description: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const updateForm = useCallback((updates: Partial<CreateContractForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const updateBuyerInput = useCallback((value: string, type: 'email' | 'farcaster') => {
    setForm(prev => ({
      ...prev,
      buyerEmail: value,
      buyerType: type
    }));
  }, []);

  const updatePayoutTimestamp = useCallback((datetimeLocal: string) => {
    setForm(prev => ({
      ...prev,
      payoutTimestamp: datetimeLocalToTimestamp(datetimeLocal)
    }));
  }, []);

  const submitContract = useCallback(async () => {
    const formValid = validateForm(form);

    if (!formValid || !config) {
      return false;
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

      // Create pending contract via Contract Service
      setLoadingMessage('Creating pending contract...');

      const pendingContractRequest = {
        buyerEmail: form.buyerType === 'email' ? form.buyerEmail : '',
        buyerFarcasterHandle: form.buyerType === 'farcaster' ? form.buyerEmail : '',
        sellerEmail: user?.email || '',
        sellerAddress: userAddress,
        amount: toMicroUSDC(parseFloat(form.amount.trim())),
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp: form.payoutTimestamp,
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
      return true;
    } catch (error: any) {
      console.error('Contract creation failed:', error);
      alert(error.message || 'Failed to create contract');
      return false;
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [form, config, user, authenticatedFetch, validateForm, router]);

  return {
    // Form state
    form,
    updateForm,
    updateBuyerInput,
    updatePayoutTimestamp,

    // Validation
    errors,
    clearErrors,

    // Loading state
    isLoading,
    loadingMessage,

    // Helper functions
    getCurrentLocalDatetime,
    getMaxLocalDatetime,
    getRelativeTime,
    timestampToDatetimeLocal: (timestamp: number) => timestampToDatetimeLocal(timestamp),

    // Actions
    submitContract
  };
}