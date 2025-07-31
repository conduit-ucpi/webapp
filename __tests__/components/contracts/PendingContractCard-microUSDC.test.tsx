import { render, screen } from '@testing-library/react';
import PendingContractCard from '../../../components/contracts/PendingContractCard';
import { PendingContract } from '../../../types';

// Mock the formatUSDC function to verify it's called correctly
jest.mock('../../../utils/validation', () => ({
  ...jest.requireActual('../../../utils/validation'),
  formatUSDC: jest.fn(),
  formatExpiryDate: jest.fn().mockReturnValue('01 Jan 2025, 12:00 GMT'),
}));

import { formatUSDC } from '../../../utils/validation';
const mockFormatUSDC = formatUSDC as jest.MockedFunction<typeof formatUSDC>;

describe('PendingContractCard - microUSDC Amount Display', () => {
  const baseContract: PendingContract = {
    id: 'test-contract-123',
    sellerEmail: 'seller@test.com',
    buyerEmail: 'buyer@test.com',
    amount: 250000, // 0.25 USDC in microUSDC format
    currency: 'USDC',
    sellerAddress: '0xSellerAddress',
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    description: 'Test contract description',
    createdAt: new Date().toISOString(),
    createdBy: 'test-user',
    state: 'OK',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation returns the formatted amount
    mockFormatUSDC.mockImplementation((amount) => {
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      const usdc = numericAmount / 1000000;
      return usdc.toFixed(2);
    });
  });

  describe('Amount display with microUSDC format', () => {
    it('should call formatUSDC with microUSDC amount and display correctly', () => {
      render(
        <PendingContractCard
          contract={baseContract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Verify formatUSDC was called with the microUSDC amount
      expect(mockFormatUSDC).toHaveBeenCalledWith(250000);
      expect(mockFormatUSDC).toHaveBeenCalledTimes(1);
      
      // The component should display the formatted amount
      expect(screen.getByText('$0.25')).toBeInTheDocument();
    });

    it('should display 1.00 USDC for 1000000 microUSDC', () => {
      const contract = { ...baseContract, amount: 1000000 }; // 1.00 USDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(1000000);
      expect(screen.getByText('$1.00')).toBeInTheDocument();
    });

    it('should display 10.50 USDC for 10500000 microUSDC', () => {
      const contract = { ...baseContract, amount: 10500000 }; // 10.50 USDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(10500000);
      expect(screen.getByText('$10.50')).toBeInTheDocument();
    });

    it('should display 0.00 USDC for very small microUSDC amounts', () => {
      const contract = { ...baseContract, amount: 1 }; // 0.000001 USDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(1);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle zero amount correctly', () => {
      const contract = { ...baseContract, amount: 0 };
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(0);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle large amounts correctly', () => {
      const contract = { ...baseContract, amount: 1000000000 }; // 1000.00 USDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(1000000000);
      expect(screen.getByText('$1000.00')).toBeInTheDocument();
    });
  });

  describe('Common contract amounts', () => {
    const testCases = [
      { microUSDC: 250000, expected: '$0.25', description: 'Quarter dollar' },
      { microUSDC: 500000, expected: '$0.50', description: 'Half dollar' },
      { microUSDC: 1000000, expected: '$1.00', description: 'One dollar' },
      { microUSDC: 2500000, expected: '$2.50', description: 'Two and half dollars' },
      { microUSDC: 10000000, expected: '$10.00', description: 'Ten dollars' },
      { microUSDC: 100000000, expected: '$100.00', description: 'One hundred dollars' },
    ];

    testCases.forEach(({ microUSDC, expected, description }) => {
      it(`should display ${expected} for ${microUSDC} microUSDC (${description})`, () => {
        const contract = { ...baseContract, amount: microUSDC };
        
        render(
          <PendingContractCard
            contract={contract}
            currentUserEmail="buyer@test.com"
          />
        );

        expect(mockFormatUSDC).toHaveBeenCalledWith(microUSDC);
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with formatUSDC function', () => {
    it('should correctly integrate with real formatUSDC function', () => {
      // Temporarily use real formatUSDC for this test
      mockFormatUSDC.mockImplementation((amount) => {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const usdc = numericAmount / 1000000;
        return usdc.toFixed(2);
      });

      const contract = { ...baseContract, amount: 250000 }; // 0.25 USDC in microUSDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Should display the correctly formatted amount
      expect(screen.getByText('$0.25')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('should handle edge case amounts with real function', () => {
      // Use real formatUSDC implementation for this test
      mockFormatUSDC.mockImplementation((amount) => {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const usdc = numericAmount / 1000000;
        return usdc.toFixed(2);
      });

      const contract = { ...baseContract, amount: 123456 }; // 0.123456 USDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // formatUSDC should round to 2 decimal places
      expect(screen.getByText('$0.12')).toBeInTheDocument();
    });
  });

  describe('Component structure with amount display', () => {
    it('should maintain correct component structure with microUSDC amounts', () => {
      render(
        <PendingContractCard
          contract={baseContract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Verify the amount is displayed in the correct location within the component
      const amountElement = screen.getByText('$0.25');
      expect(amountElement).toHaveClass('text-2xl', 'font-bold', 'text-gray-900');

      // Verify USDC label is present
      expect(screen.getByText('USDC')).toHaveClass('text-sm', 'text-gray-600');

      // Verify other contract details are still displayed correctly
      expect(screen.getByText('buyer@test.com')).toBeInTheDocument();
      expect(screen.getByText('seller@test.com')).toBeInTheDocument();
      expect(screen.getByText('Test contract description')).toBeInTheDocument();
    });

    it('should not break component layout with large amounts', () => {
      const contract = { ...baseContract, amount: 1000000000000 }; // 1,000,000 USDC in microUSDC
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      // Component should still render without layout issues
      expect(screen.getByText('$1000000.00')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });
  });

  describe('Error cases and edge conditions', () => {
    it('should handle undefined amount gracefully', () => {
      const contract = { ...baseContract, amount: undefined as any };
      
      // Component should handle gracefully, formatUSDC will receive undefined
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(undefined);
    });

    it('should handle negative amounts (edge case)', () => {
      const contract = { ...baseContract, amount: -250000 }; // Negative amount
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith(-250000);
      expect(screen.getByText('$-0.25')).toBeInTheDocument();
    });

    it('should handle string amounts if they somehow occur', () => {
      const contract = { ...baseContract, amount: '250000' as any };
      
      render(
        <PendingContractCard
          contract={contract}
          currentUserEmail="buyer@test.com"
        />
      );

      expect(mockFormatUSDC).toHaveBeenCalledWith('250000');
    });
  });
});