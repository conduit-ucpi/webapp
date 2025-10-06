/**
 * Test to specifically verify the Enhanced Dashboard pending contract bug is fixed
 * This test simulates the exact scenario: pending contract with 1000 microUSDC showing as $1000
 */

import { render, screen } from '@testing-library/react';
import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import { PendingContract } from '@/types';

// Mock the auth hook
jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: {
      email: 'test@example.com',
      walletAddress: '0x1234567890abcdef'
    }
  })
}));

describe('Enhanced Dashboard Pending Contract Bug Fix', () => {
  const createPendingContract = (amount: number): PendingContract => ({
    id: 'test-pending-123',
    sellerEmail: 'seller@test.com',
    buyerEmail: 'buyer@test.com',
    amount: amount, // This is in microUSDC as per CLAUDE.md
    currency: 'USDC', // Legacy field from database
    sellerAddress: '0xSellerAddress',
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
    description: 'Test pending contract',
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: 'test-user',
    state: 'OK',
  });

  describe('Pending contract currency display in Enhanced Dashboard', () => {
    it('should display 1000 microUSDC as $0.0010 (not $1000) for pending contracts', () => {
      const pendingContract = createPendingContract(1000); // 1000 microUSDC from MongoDB

      render(
        <EnhancedContractCard
          contract={pendingContract}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      // Should show the correct amount for pending contract
      expect(screen.getByText('$0.0010')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$1000')).not.toBeInTheDocument();
      expect(screen.queryByText('$1000.0000')).not.toBeInTheDocument();
    });

    it('should display 250000 microUSDC as $0.2500 (not $250000) for pending contracts', () => {
      const pendingContract = createPendingContract(250000); // 250000 microUSDC = $0.25

      render(
        <EnhancedContractCard
          contract={pendingContract}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$0.2500')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$250000')).not.toBeInTheDocument();
    });

    it('should display 1000000 microUSDC as $1.0000 (not $1000000) for pending contracts', () => {
      const pendingContract = createPendingContract(1000000); // 1000000 microUSDC = $1.00

      render(
        <EnhancedContractCard
          contract={pendingContract}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      // Should show the correct amount
      expect(screen.getByText('$1.0000')).toBeInTheDocument();

      // Should NOT show the buggy amount
      expect(screen.queryByText('$1000000')).not.toBeInTheDocument();
    });
  });

  describe('Verify pending vs active contract behavior is consistent', () => {
    it('should show the same amount for pending and active contracts with the same microUSDC value', () => {
      const pendingContract = createPendingContract(5000000); // 5000000 microUSDC = $5.00

      // Create equivalent active contract
      const activeContract = {
        id: 'test-active-123',
        contractAddress: '0xActiveContract123',
        buyerAddress: '0xBuyer',
        sellerAddress: '0xSeller',
        amount: 5000000, // Same amount in microUSDC
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test active contract',
        status: 'ACTIVE' as const,
        createdAt: Math.floor(Date.now() / 1000),
        funded: true,
        buyerEmail: 'buyer@test.com',
        sellerEmail: 'seller@test.com',
        productName: 'Test Product',
        adminNotes: [],
        disputes: []
      };

      // Render pending contract
      const { rerender } = render(
        <EnhancedContractCard
          contract={pendingContract}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      expect(screen.getByText('$5.0000')).toBeInTheDocument();

      // Render active contract
      rerender(
        <EnhancedContractCard
          contract={activeContract}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      // Should show the same amount for both pending and active
      expect(screen.getByText('$5.0000')).toBeInTheDocument();
    });
  });

  describe('Demonstrate the fix for the specific user-reported bug', () => {
    it('should fix the exact case: pending contract from database with 1000 microUSDC shows as $0.001 not $1000', () => {
      // This simulates the exact data coming from MongoDB
      const contractFromDatabase = createPendingContract(1000);

      render(
        <EnhancedContractCard
          contract={contractFromDatabase}
          onAction={jest.fn()}
          onClick={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );

      // The fix: should show $0.001 (correct conversion from 1000 microUSDC)
      expect(screen.getByText('$0.0010')).toBeInTheDocument();

      // The bug: should NOT show $1000 (incorrect)
      expect(screen.queryByText('$1000')).not.toBeInTheDocument();
      expect(screen.queryByText('$1000.0000')).not.toBeInTheDocument();

      // Also verify it shows as pending
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });
});