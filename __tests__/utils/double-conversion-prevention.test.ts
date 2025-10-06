/**
 * Test to demonstrate the fix for the double conversion bug reported by user
 * This simulates the exact scenario: "1000USD when it's really 1000microUSDC"
 */

import { displayCurrency } from '@/utils/validation';

describe('Double Conversion Prevention Test', () => {
  describe('The exact bug scenario reported by user', () => {
    it('should show 1000 microUSDC as $0.001 (NOT $1000)', () => {
      // This is the exact scenario the user reported
      const contractAmountFromMongo = 1000; // 1000 microUSDC from database

      // BEFORE the fix: this would show $1000 (wrong!)
      // AFTER the fix: this should show $0.001 (correct!)
      const result = displayCurrency(contractAmountFromMongo, 'microUSDC');

      expect(result).toBe('$0.0010'); // Correct: 1000 microUSDC = $0.001 USDC
      expect(result).not.toBe('$1000.0000'); // Wrong: this would be the bug
    });

    it('should show 1000000 microUSDC as $1.00 (NOT $1000000)', () => {
      const contractAmountFromMongo = 1000000; // 1 USDC worth in microUSDC

      const result = displayCurrency(contractAmountFromMongo, 'microUSDC');

      expect(result).toBe('$1.0000'); // Correct: 1000000 microUSDC = $1.00 USDC
      expect(result).not.toBe('$1000000.0000'); // Wrong: would be 1000x too large
    });
  });

  describe('Simulation of old buggy behavior vs new correct behavior', () => {
    it('should demonstrate the difference between old and new behavior', () => {
      const testCases = [
        { microUSDC: 1000, correctUSDC: '$0.0010', buggyUSDC: '$1000.0000' },
        { microUSDC: 250000, correctUSDC: '$0.2500', buggyUSDC: '$250000.0000' },
        { microUSDC: 1000000, correctUSDC: '$1.0000', buggyUSDC: '$1000000.0000' },
        { microUSDC: 5000000, correctUSDC: '$5.0000', buggyUSDC: '$5000000.0000' },
      ];

      testCases.forEach(({ microUSDC, correctUSDC, buggyUSDC }) => {
        const actualResult = displayCurrency(microUSDC, 'microUSDC');

        // Should show the correct amount
        expect(actualResult).toBe(correctUSDC);

        // Should NOT show the buggy amount (1000x too large)
        expect(actualResult).not.toBe(buggyUSDC);
      });
    });
  });

  describe('Verify the legacy USDC parameter behavior for comparison', () => {
    it('should show how the legacy USDC parameter caused the bug', () => {
      // This simulates the OLD buggy behavior where we passed 'USDC' instead of 'microUSDC'
      const amount = 1000; // 1000 microUSDC from database

      // With 'USDC' parameter (old buggy way):
      // Small amounts < 10000 with 'USDC' are treated as already converted
      const legacyResult = displayCurrency(amount, 'USDC');
      expect(legacyResult).toBe('$1000.0000'); // This was the bug!

      // With 'microUSDC' parameter (new correct way):
      const correctResult = displayCurrency(amount, 'microUSDC');
      expect(correctResult).toBe('$0.0010'); // This is correct!

      // Demonstrate they're different
      expect(legacyResult).not.toBe(correctResult);
    });

    it('should show how larger amounts would work with both parameters', () => {
      const amount = 250000; // 250000 microUSDC = $0.25 USDC

      // With 'USDC' parameter (triggers legacy smart detection for large amounts):
      const legacyResult = displayCurrency(amount, 'USDC');
      expect(legacyResult).toBe('$0.2500'); // This works because amount >= 1000

      // With 'microUSDC' parameter (new correct way):
      const correctResult = displayCurrency(amount, 'microUSDC');
      expect(correctResult).toBe('$0.2500'); // Same result!

      // Both happen to be the same for larger amounts
      expect(legacyResult).toBe(correctResult);
    });
  });

  describe('Edge cases that would reveal double conversion', () => {
    it('should handle the boundary case of 10000 microUSDC correctly', () => {
      // This is right at the boundary of the legacy smart detection
      const amount = 10000; // 10000 microUSDC = $0.01 USDC

      const result = displayCurrency(amount, 'microUSDC');
      expect(result).toBe('$0.0100'); // Should be 1 cent
      expect(result).not.toBe('$10000.0000'); // Should NOT be $10,000
    });

    it('should verify no conversion is applied twice', () => {
      // If conversion was applied twice, these would be way off
      const testCases = [
        { input: 1000000, expected: '$1.0000', notExpected: '$0.0010' }, // 1 USDC
        { input: 5000000, expected: '$5.0000', notExpected: '$0.0050' }, // 5 USDC
      ];

      testCases.forEach(({ input, expected, notExpected }) => {
        const result = displayCurrency(input, 'microUSDC');
        expect(result).toBe(expected);
        expect(result).not.toBe(notExpected); // Would be double conversion
      });
    });
  });
});