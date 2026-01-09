/**
 * Integration tests for buyer/seller same person validation in hooks
 * Tests useCreateContractValidation and useContractCreateValidation
 */

import { renderHook, act } from '@testing-library/react';
import { useCreateContractValidation, useContractCreateValidation } from '@/hooks/useContractValidation';

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

  describe('useContractCreateValidation - Buyer makes payment', () => {
    it('should reject when seller wallet matches buyer wallet (exact case)', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      const form = {
        seller: BUYER_WALLET,
        amount: '10.00',
        description: 'Test payment'
      };

      const buyerInfo = {
        walletAddress: BUYER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, undefined, buyerInfo);
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.seller).toContain('cannot make a payment to yourself');
      expect(result.current.errors.seller).toContain(BUYER_WALLET);
    });

    it('should reject when seller wallet matches buyer wallet (different case)', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      const form = {
        seller: BUYER_WALLET.toLowerCase(),
        amount: '10.00',
        description: 'Test payment'
      };

      const buyerInfo = {
        walletAddress: BUYER_WALLET.toUpperCase()
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, undefined, buyerInfo);
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.seller).toContain('cannot make a payment to yourself');
    });

    it('should accept when seller and buyer are different wallets', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      const form = {
        seller: SELLER_WALLET,
        amount: '10.00',
        description: 'Test payment'
      };

      const buyerInfo = {
        walletAddress: BUYER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, undefined, buyerInfo);
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.seller).toBeUndefined();
    });

    it('should still validate without buyer info provided', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      const form = {
        seller: SELLER_WALLET,
        amount: '10.00',
        description: 'Test payment'
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form);
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.seller).toBeUndefined();
    });

    it('should handle WordPress context parameters while checking buyer/seller', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      const form = {
        seller: BUYER_WALLET,
        amount: '10.00',
        description: 'Test payment'
      };

      const wordpressContext = {
        wordpress_source: 'true',
        webhook_url: 'https://example.com/webhook',
        order_id: '12345'
      };

      const buyerInfo = {
        walletAddress: BUYER_WALLET
      };

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm(form, wordpressContext, buyerInfo);
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.seller).toContain('cannot make a payment to yourself');
    });
  });
});
