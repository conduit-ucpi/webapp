import { useState, useCallback } from 'react';
import {
  isValidAmount,
  isValidDescription,
  isValidBuyerIdentifier,
  isValidWalletAddress
} from '@/utils/validation';

// Validation error types
export interface CreateContractErrors {
  buyerEmail?: string;
  amount?: string;
  expiry?: string;
  description?: string;
}

export interface ContractCreateErrors {
  seller?: string;
  amount?: string;
  description?: string;
}

// Form data types
export interface CreateContractForm {
  buyerEmail: string;
  amount: string;
  payoutTimestamp: number;
  description: string;
}

export interface ContractCreateForm {
  seller: string;
  amount: string;
  description: string;
}

// WordPress validation context
export interface WordPressValidationContext {
  wordpress_source?: string | string[];
  webhook_url?: string | string[];
  order_id?: string | string[];
}

/**
 * Hook for validating create contract forms (main app)
 * Handles business validation logic separate from UI components
 */
export function useCreateContractValidation() {
  const [errors, setErrors] = useState<CreateContractErrors>({});

  const validateForm = useCallback((form: CreateContractForm): boolean => {
    const newErrors: CreateContractErrors = {};

    // Validate buyer identifier (email or Farcaster handle)
    const buyerValidation = isValidBuyerIdentifier(form.buyerEmail);
    if (!buyerValidation.isValid) {
      newErrors.buyerEmail = buyerValidation.error || 'Invalid buyer identifier';
    }

    // Validate amount
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
      newErrors.expiry = 'Payout time cannot be more than 1 year in the future';
    }

    // Validate description
    if (!isValidDescription(form.description)) {
      newErrors.description = 'Description must be 1-160 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateForm,
    clearErrors
  };
}

/**
 * Hook for validating contract-create forms (WordPress plugin)
 * Handles business validation logic separate from UI components
 */
export function useContractCreateValidation() {
  const [errors, setErrors] = useState<ContractCreateErrors>({});

  const validateForm = useCallback((
    form: ContractCreateForm,
    wordpressContext?: WordPressValidationContext
  ): boolean => {
    const newErrors: ContractCreateErrors = {};

    // Validate seller (must be wallet address)
    if (!isValidWalletAddress(form.seller)) {
      newErrors.seller = 'Invalid seller wallet address';
    }

    // Validate amount
    if (!isValidAmount(form.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    // Validate description
    if (!isValidDescription(form.description)) {
      newErrors.description = 'Description must be 1-160 characters';
    }

    // Validate WordPress integration parameters if applicable
    if (wordpressContext?.wordpress_source === 'true') {
      if (!wordpressContext.webhook_url) {
        console.error('WordPress integration missing webhook_url parameter');
        alert('Configuration error: Missing webhook URL for WordPress integration');
        return false;
      }

      if (!wordpressContext.order_id) {
        console.error('WordPress integration missing order_id parameter');
        alert('Configuration error: Missing order ID for WordPress integration');
        return false;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateForm,
    clearErrors
  };
}

/**
 * Hook for validating contract acceptance forms
 * Handles balance and contract state validation
 */
export function useContractAcceptanceValidation() {
  const validateSufficientBalance = useCallback((
    userBalance: string | null,
    contractAmount: number | string,
    contractCurrency?: string
  ): boolean => {
    if (!userBalance || !contractAmount) return false;

    // SDK returns balance as decimal USDC string (e.g., "0.46269")
    // Contract amount is in microUSDC (e.g., 1000000 for $1.00)
    // Convert SDK balance to microUSDC for comparison
    const balanceInUSDC = parseFloat(userBalance);
    const balanceInMicroUSDC = Math.round(balanceInUSDC * 1000000);
    const requiredAmount = typeof contractAmount === 'string'
      ? parseInt(contractAmount)
      : contractAmount;

    return balanceInMicroUSDC >= requiredAmount;
  }, []);

  const validateContractState = useCallback((contractState?: string): boolean => {
    return contractState === 'OK' || !contractState;
  }, []);

  return {
    validateSufficientBalance,
    validateContractState
  };
}