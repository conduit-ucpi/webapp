/**
 * End-to-end test to verify components display currency correctly
 * without double conversion when using real contract data
 */

import { render, screen } from '@testing-library/react';
import PendingContractCard from '@/components/contracts/PendingContractCard';
import { PendingContract } from '@/types';

// Import the REAL functions (not mocked) to test actual behavior
import { displayCurrency, formatDateTimeWithTZ } from '@/utils/validation';

describe('Currency Display E2E Test - Real Components with Real Functions', () => {
  const createTestContract = (amount: number): PendingContract => ({
    id: 'test-contract-123',
    sellerEmail: 'seller@test.com',
    buyerEmail: 'buyer@test.com',
    amount: amount, // This is in microUSDC as per CLAUDE.md
    currency: 'USDC', // Legacy field from database
    sellerAddress: '0xSellerAddress',
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
    description: 'Test contract description',
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: 'test-user',
    state: 'OK',
  });

  describe('Real component with real functions - no mocking', () => {
    it('should display 1000 microUSDC as $0.0010 (not $1000)', () => {
      const contract = createTestContract(1000); // 1000 microUSDC

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$0.0010')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$1000.0000')).not.toBeInTheDocument();
      expect(screen.queryByText('$1000')).not.toBeInTheDocument();
    });

    it('should display 250000 microUSDC as $0.2500 (not $250000)', () => {
      const contract = createTestContract(250000); // 250000 microUSDC = $0.25

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$0.2500')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$250000.0000')).not.toBeInTheDocument();
      expect(screen.queryByText('$250000')).not.toBeInTheDocument();
    });

    it('should display 1000000 microUSDC as $1.0000 (not $1000000)', () => {
      const contract = createTestContract(1000000); // 1000000 microUSDC = $1.00

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$1.0000')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$1000000.0000')).not.toBeInTheDocument();
      expect(screen.queryByText('$1000000')).not.toBeInTheDocument();
    });

    it('should display 10000000 microUSDC as $10.0000 (not $10000000)', () => {
      const contract = createTestContract(10000000); // 10000000 microUSDC = $10.00

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$10.0000')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$10000000.0000')).not.toBeInTheDocument();
      expect(screen.queryByText('$10000000')).not.toBeInTheDocument();
    });
  });

  describe('Real-world edge cases', () => {
    it('should handle zero amount correctly', () => {
      const contract = createTestContract(0); // 0 microUSDC

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('should handle very small amounts correctly', () => {
      const contract = createTestContract(1); // 1 microUSDC = 0.000001 USDC

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // 1 microUSDC is so small it rounds to $0.00
      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('should handle large amounts correctly', () => {
      const contract = createTestContract(100000000); // 100000000 microUSDC = $100.00

      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(screen.getByText('$100.0000')).toBeInTheDocument();
      expect(screen.queryByText('$100000000')).not.toBeInTheDocument();
    });
  });

  describe('Verify the fix directly addresses the reported issue', () => {
    it('should demonstrate the exact bug fix: 1000 microUSDC from MongoDB shows as $0.001 not $1000', () => {
      // This simulates the exact scenario user reported:
      // "showing 1000USD when it's really 1000microUSDC"

      const contractFromMongoDB = createTestContract(1000);

      render(
        <PendingContractCard
          contract={contractFromMongoDB}
          currentUserEmail="buyer@test.com"
        />
      );

      // The fix: should show $0.001 (correct)
      expect(screen.getByText('$0.0010')).toBeInTheDocument();

      // The bug: should NOT show $1000 (incorrect)
      expect(screen.queryByText('$1000')).not.toBeInTheDocument();
      expect(screen.queryByText('$1000.0000')).not.toBeInTheDocument();
    });
  });

  describe('Verify displayCurrency function directly', () => {
    it('should verify the function behavior matches component behavior', () => {
      // Test the exact function calls that components make
      const testCases = [
        { microUSDC: 1000, expected: '$0.0010' },
        { microUSDC: 250000, expected: '$0.2500' },
        { microUSDC: 1000000, expected: '$1.0000' },
        { microUSDC: 10000000, expected: '$10.0000' },
      ];

      testCases.forEach(({ microUSDC, expected }) => {
        const result = displayCurrency(microUSDC, 'microUSDC');
        expect(result).toBe(expected);
      });
    });

    it('should handle currency parameters correctly based on their meaning', () => {
      // Different currency parameters should behave differently based on their meaning
      const amount = 1000;

      // 'USDC' parameter: treat as already-converted USDC
      const result1 = displayCurrency(amount, 'USDC');
      expect(result1).toBe('$1000.0000'); // 1000 USDC = $1000

      // 'microUSDC' parameter: convert from microUSDC to USDC
      const result2 = displayCurrency(amount, 'microUSDC');
      expect(result2).toBe('$0.0010'); // 1000 microUSDC = $0.001

      // 'UNKNOWN' parameter: default to microUSDC conversion
      const result3 = displayCurrency(amount, 'UNKNOWN');
      expect(result3).toBe('$0.0010'); // defaults to microUSDC conversion

      // Only microUSDC and unknown should behave the same
      expect(result2).toBe(result3);
      expect(result1).not.toBe(result2); // USDC vs microUSDC should be different
    });
  });
});