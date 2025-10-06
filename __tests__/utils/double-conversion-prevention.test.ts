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

  describe('Verify proper currency parameter handling', () => {
    it('should correctly handle different currency parameters', () => {
      const amount = 1000; // This could be 1000 microUSDC OR 1000 USDC depending on parameter

      // With 'USDC' parameter: treat as 1000 USDC (already converted)
      const usdcParamResult = displayCurrency(amount, 'USDC');
      expect(usdcParamResult).toBe('$1000.0000'); // 1000 USDC displayed as $1000

      // With 'microUSDC' parameter: treat as 1000 microUSDC (needs conversion)
      const microUsdcParamResult = displayCurrency(amount, 'microUSDC');
      expect(microUsdcParamResult).toBe('$0.0010'); // 1000 microUSDC = $0.001

      // Parameters behave differently based on input currency
      expect(usdcParamResult).not.toBe(microUsdcParamResult);
    });

    it('should demonstrate the fix prevents the original bug', () => {
      // Original bug: microUSDC amounts from database were displayed with wrong currency parameter
      const microUsdcFromDatabase = 250000; // 250000 microUSDC = $0.25 USDC

      // CORRECT: Using 'microUSDC' parameter for microUSDC amounts
      const correctResult = displayCurrency(microUsdcFromDatabase, 'microUSDC');
      expect(correctResult).toBe('$0.2500');

      // WRONG: Using 'USDC' parameter for microUSDC amounts (would cause the bug)
      // This would show $250,000 instead of $0.25 - but that's what caller asked for
      const wrongParameterResult = displayCurrency(microUsdcFromDatabase, 'USDC');
      expect(wrongParameterResult).toBe('$250000.0000');

      // The fix is: use the correct parameter for your data type
      expect(correctResult).not.toBe(wrongParameterResult);
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