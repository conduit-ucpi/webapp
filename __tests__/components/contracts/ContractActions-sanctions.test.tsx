import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');

import { useRouter } from 'next/router';
import ContractActions from '@/components/contracts/ContractActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';

/** A refused escrow is a status for everyone, never a route back to paying it. */
describe('ContractActions - sanctions refusal', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ basePath: '', pathname: '/dashboard', query: {}, asPath: '/dashboard', push: jest.fn() });
    (useConfig as jest.Mock).mockReturnValue({ config: { chainId: 8453, serviceLink: 'http://localhost:3000' }, isLoading: false });
    (useAuth as jest.Mock).mockReturnValue({
      user: { userId: 'u', email: 'buyer@test.com', walletAddress: '0xBuyer', authProvider: 'web3auth' },
      isLoading: false, isConnected: true, error: null, disconnect: jest.fn(), authenticatedFetch: jest.fn()
    });
  });

  it('shows the refusal and offers no button', () => {
    const contract: any = {
      id: 'c1', status: 'SANCTIONS_REFUSED', ctaType: 'SANCTIONS_REFUSED', ctaLabel: 'Refused: sanctions check',
      ctaVariant: 'STATUS', buyerEmail: 'buyer@test.com', sellerAddress: '0xSeller', amount: 1000, expiryTimestamp: 1900000000
    };
    render(<ContractActions contract={contract} isBuyer isSeller={false} onAction={jest.fn()} />);

    expect(screen.getByText(/Refused: sanctions check\. Do not send any more funds/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
