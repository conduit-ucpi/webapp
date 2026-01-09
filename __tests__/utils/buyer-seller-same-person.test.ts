/**
 * Tests for buyer/seller same person validation
 * Ensures users cannot create contracts where buyer and seller are the same
 */

import { addressesEqual, emailsEqual } from '@/utils/address';

describe('Buyer/Seller Same Person Validation', () => {
  describe('addressesEqual', () => {
    it('should return true for identical addresses', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(addressesEqual(address, address)).toBe(true);
    });

    it('should return true for addresses with different case', () => {
      const address1 = '0x1234567890abcdef1234567890abcdef12345678';
      const address2 = '0X1234567890ABCDEF1234567890ABCDEF12345678';
      expect(addressesEqual(address1, address2)).toBe(true);
    });

    it('should return true for addresses with mixed case', () => {
      const address1 = '0x1234567890abcdef1234567890abcdef12345678';
      const address2 = '0x1234567890AbCdEf1234567890aBcDeF12345678';
      expect(addressesEqual(address1, address2)).toBe(true);
    });

    it('should return false for different addresses', () => {
      const address1 = '0x1234567890abcdef1234567890abcdef12345678';
      const address2 = '0xabcdef1234567890abcdef1234567890abcdef12';
      expect(addressesEqual(address1, address2)).toBe(false);
    });

    it('should return false when one address is undefined', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(addressesEqual(address, undefined)).toBe(false);
      expect(addressesEqual(undefined, address)).toBe(false);
    });

    it('should return false when one address is null', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(addressesEqual(address, null)).toBe(false);
      expect(addressesEqual(null, address)).toBe(false);
    });

    it('should return false when both addresses are undefined', () => {
      expect(addressesEqual(undefined, undefined)).toBe(false);
    });

    it('should handle addresses with extra whitespace', () => {
      const address1 = '  0x1234567890abcdef1234567890abcdef12345678  ';
      const address2 = '0x1234567890abcdef1234567890abcdef12345678';
      expect(addressesEqual(address1, address2)).toBe(true);
    });
  });

  describe('emailsEqual', () => {
    it('should return true for identical emails', () => {
      const email = 'test@example.com';
      expect(emailsEqual(email, email)).toBe(true);
    });

    it('should return true for emails with different case', () => {
      const email1 = 'test@example.com';
      const email2 = 'TEST@EXAMPLE.COM';
      expect(emailsEqual(email1, email2)).toBe(true);
    });

    it('should return true for emails with mixed case', () => {
      const email1 = 'test@example.com';
      const email2 = 'TeSt@ExAmPlE.CoM';
      expect(emailsEqual(email1, email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = 'test@example.com';
      const email2 = 'other@example.com';
      expect(emailsEqual(email1, email2)).toBe(false);
    });

    it('should return false when one email is undefined', () => {
      const email = 'test@example.com';
      expect(emailsEqual(email, undefined)).toBe(false);
      expect(emailsEqual(undefined, email)).toBe(false);
    });

    it('should return false when one email is null', () => {
      const email = 'test@example.com';
      expect(emailsEqual(email, null)).toBe(false);
      expect(emailsEqual(null, email)).toBe(false);
    });

    it('should return false when both emails are undefined', () => {
      expect(emailsEqual(undefined, undefined)).toBe(false);
    });

    it('should handle emails with extra whitespace', () => {
      const email1 = '  test@example.com  ';
      const email2 = 'test@example.com';
      expect(emailsEqual(email1, email2)).toBe(true);
    });
  });
});
