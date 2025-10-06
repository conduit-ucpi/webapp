/**
 * Integration test to verify currency display functions work correctly
 * and don't double-apply conversions
 */

import { displayCurrency, formatCurrency, fromMicroUSDC, toMicroUSDC } from '@/utils/validation';

describe('Currency Display Integration - No Double Conversion', () => {
  describe('displayCurrency with microUSDC amounts', () => {
    it('should correctly convert 1000 microUSDC to $0.001 (not $1000)', () => {
      const result = displayCurrency(1000, 'microUSDC');
      expect(result).toBe('$0.0010');
    });

    it('should correctly convert 250000 microUSDC to $0.25 (not $250000)', () => {
      const result = displayCurrency(250000, 'microUSDC');
      expect(result).toBe('$0.2500');
    });

    it('should correctly convert 1000000 microUSDC to $1.00 (not $1000000)', () => {
      const result = displayCurrency(1000000, 'microUSDC');
      expect(result).toBe('$1.0000');
    });

    it('should correctly convert 1500000 microUSDC to $1.50 (not $1500000)', () => {
      const result = displayCurrency(1500000, 'microUSDC');
      expect(result).toBe('$1.5000');
    });

    it('should correctly convert 10000000 microUSDC to $10.00 (not $10000000)', () => {
      const result = displayCurrency(10000000, 'microUSDC');
      expect(result).toBe('$10.0000');
    });
  });

  describe('Verify no double conversion with legacy USDC parameter', () => {
    it('should handle large amounts with USDC parameter correctly (legacy compatibility)', () => {
      // Large amounts with 'USDC' should be treated as microUSDC
      const result = displayCurrency(1000000, 'USDC');
      expect(result).toBe('$1.0000'); // Should convert 1000000 microUSDC to $1.00
    });

    it('should handle small amounts with USDC parameter as already converted', () => {
      // Small amounts with 'USDC' should be treated as already in USDC
      const result = displayCurrency(1, 'USDC');
      expect(result).toBe('$1.0000'); // Should treat 1 as 1 USDC
    });
  });

  describe('Edge cases that could reveal double conversion', () => {
    it('should handle zero correctly', () => {
      expect(displayCurrency(0, 'microUSDC')).toBe('$0.0000');
    });

    it('should handle very small amounts correctly', () => {
      expect(displayCurrency(1, 'microUSDC')).toBe('$0.0000'); // 1 microUSDC = 0.000001 USDC ≈ $0.00
    });

    it('should handle very large amounts correctly', () => {
      expect(displayCurrency(1000000000, 'microUSDC')).toBe('$1000.0000'); // 1 billion microUSDC = $1000
    });
  });

  describe('Consistency check with helper functions', () => {
    it('should be consistent with fromMicroUSDC conversion', () => {
      const microUSDC = 2500000; // $2.50
      const converted = fromMicroUSDC(microUSDC);
      const displayed = displayCurrency(microUSDC, 'microUSDC');

      expect(converted).toBe(2.5);
      expect(displayed).toBe('$2.5000');
    });

    it('should be consistent with toMicroUSDC round-trip conversion', () => {
      const originalUSDC = '5.75';
      const microUSDC = toMicroUSDC(originalUSDC);
      const displayed = displayCurrency(microUSDC, 'microUSDC');

      expect(microUSDC).toBe(5750000);
      expect(displayed).toBe('$5.7500');
    });
  });

  describe('Real-world contract amounts', () => {
    // These are typical amounts that might be stored in the database
    const testCases = [
      { microUSDC: 100000, expectedDisplay: '$0.1000', description: '10 cents' },
      { microUSDC: 500000, expectedDisplay: '$0.5000', description: '50 cents' },
      { microUSDC: 1000000, expectedDisplay: '$1.0000', description: '1 dollar' },
      { microUSDC: 2500000, expectedDisplay: '$2.5000', description: '2.50 dollars' },
      { microUSDC: 10000000, expectedDisplay: '$10.0000', description: '10 dollars' },
      { microUSDC: 50000000, expectedDisplay: '$50.0000', description: '50 dollars' },
      { microUSDC: 100000000, expectedDisplay: '$100.0000', description: '100 dollars' },
    ];

    testCases.forEach(({ microUSDC, expectedDisplay, description }) => {
      it(`should correctly display ${description} (${microUSDC} microUSDC) as ${expectedDisplay}`, () => {
        const result = displayCurrency(microUSDC, 'microUSDC');
        expect(result).toBe(expectedDisplay);
      });
    });
  });

  describe('Detect double conversion errors', () => {
    it('should NOT show $0.001 as $0.000001 (double conversion error)', () => {
      const microUSDC = 1000; // This should be $0.001
      const result = displayCurrency(microUSDC, 'microUSDC');

      // If there was double conversion, this might show as $0.000001
      expect(result).toBe('$0.0010');
      expect(result).not.toBe('$0.0000'); // Would be double conversion error
    });

    it('should NOT show $1000 as $1000000 (reverse double conversion error)', () => {
      const microUSDC = 1000000000; // This should be $1000
      const result = displayCurrency(microUSDC, 'microUSDC');

      // If there was incorrect conversion, this might show as $1000000
      expect(result).toBe('$1000.0000');
      expect(result).not.toBe('$1000000.0000'); // Would be conversion error
    });
  });
});