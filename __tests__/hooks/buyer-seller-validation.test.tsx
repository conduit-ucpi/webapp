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
        description: 'Test payment',
        arbiterAddress: ''
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
        description: 'Test payment',
        arbiterAddress: ''
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
        description: 'Test payment',
        arbiterAddress: ''
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
        description: 'Test payment',
        arbiterAddress: ''
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
        description: 'Test payment',
        arbiterAddress: ''
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

  describe('useContractCreateValidation - Optional arbiterAddress', () => {
    // Third valid checksummed address (distinct from SELLER_WALLET and BUYER_WALLET above)
    const ARBITER_WALLET = '0xdD870fA1b7C4700F2BD7f44238821C26f7392148';

    const baseForm = {
      seller: SELLER_WALLET,
      amount: '10.00',
      description: 'Test payment'
    };

    it('should be valid when arbiterAddress is blank', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({ ...baseForm, arbiterAddress: '' });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.arbiterAddress).toBeUndefined();
    });

    it('should be valid when arbiterAddress is whitespace-only', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({ ...baseForm, arbiterAddress: '   ' });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.arbiterAddress).toBeUndefined();
    });

    it('should be valid when arbiterAddress is a valid checksummed address', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({ ...baseForm, arbiterAddress: ARBITER_WALLET });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.arbiterAddress).toBeUndefined();
    });

    it('should be valid when arbiterAddress is a lowercase (non-checksummed) valid address', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({
          ...baseForm,
          arbiterAddress: ARBITER_WALLET.toLowerCase()
        });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors.arbiterAddress).toBeUndefined();
    });

    it('should surface an error for a plainly invalid arbiterAddress string', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({ ...baseForm, arbiterAddress: 'not-an-address' });
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.arbiterAddress).toBe('Invalid arbiter wallet address');
    });

    it('should surface an error for a too-short 0x-prefixed arbiterAddress', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({ ...baseForm, arbiterAddress: '0x1234' });
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.arbiterAddress).toBe('Invalid arbiter wallet address');
    });

    it('should not surface an arbiterAddress error when other fields are invalid but arbiter is blank', () => {
      const { result } = renderHook(() => useContractCreateValidation());

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm({
          seller: 'not-a-wallet',
          amount: 'abc',
          description: '',
          arbiterAddress: ''
        });
      });

      expect(isValid!).toBe(false);
      // Other errors should be set, but arbiterAddress should remain clean
      expect(result.current.errors.arbiterAddress).toBeUndefined();
    });
  });
});
