/**
 * Integration tests for buyer/seller same person validation in hooks
 * Tests useCreateContractValidation
 */

import { renderHook, act } from '@testing-library/react';
import { useCreateContractValidation } from '@/hooks/useContractValidation';

describe('Buyer/Seller Validation Hooks', () => {
  // Valid test wallet addresses (checksummed from ethers test vectors)
  const SELLER_WALLET = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  const BUYER_WALLET = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

  describe('useCreateContractValidation - Seller creates payment request', () => {
    it('should reject when buyer email matches seller email (exact case)', () => {
      const { result } = renderHook(() => useCreateContractValidation());

      const form = {
        buyerEmail: 'test@example.com',
        amount: '10.00',
        payoutTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test payment'
      };

      const sellerInfo = {
        email: 'test@example.com',
        walletAddress: SELLER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, sellerInfo);
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.buyerEmail).toContain('cannot create a payment request to yourself');
      expect(result.current.errors.buyerEmail).toContain('test@example.com');
    });

    it('should reject when buyer email matches seller email (different case)', () => {
      const { result } = renderHook(() => useCreateContractValidation());

      const form = {
        buyerEmail: 'TEST@EXAMPLE.COM',
        amount: '10.00',
        payoutTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test payment'
      };

      const sellerInfo = {
        email: 'test@example.com',
        walletAddress: SELLER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, sellerInfo);
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.buyerEmail).toContain('cannot create a payment request to yourself');
    });

    it('should accept when buyer and seller have different emails', () => {
      const { result } = renderHook(() => useCreateContractValidation());

      const form = {
        buyerEmail: 'buyer@example.com',
        amount: '10.00',
        payoutTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test payment'
      };

      const sellerInfo = {
        email: 'seller@example.com',
        walletAddress: SELLER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, sellerInfo);
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.buyerEmail).toBeUndefined();
    });

    it('should still validate without seller info provided', () => {
      const { result } = renderHook(() => useCreateContractValidation());

      const form = {
        buyerEmail: 'buyer@example.com',
        amount: '10.00',
        payoutTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test payment'
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form);
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.buyerEmail).toBeUndefined();
    });

    it('should accept Farcaster handles as buyer identifier', () => {
      const { result } = renderHook(() => useCreateContractValidation());

      const form = {
        buyerEmail: '@username',
        amount: '10.00',
        payoutTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test payment'
      };

      const sellerInfo = {
        email: 'seller@example.com',
        walletAddress: SELLER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, sellerInfo);
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.buyerEmail).toBeUndefined();
    });
  });
});
