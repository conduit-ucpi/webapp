import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');

import { useRouter } from 'next/router';
import ContractActions from '../../../components/contracts/ContractActions';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

/**
 * AWAITING_FUNDING means different things to the two parties.
 *
 * The seller is waiting to be paid — a status. The buyer still has to pay, or
 * has already sent funds that were never swept into the escrow. Rendering a
 * label for them removed the only route to the pay page, so a payment already
 * made sat unclaimable with no way to finish it.
 */
describe('ContractActions - AWAITING_FUNDING', () => {
  const push = jest.fn();

  const contract = {
    id: 'contract-1',
    ctaType: 'AWAITING_FUNDING',
    ctaLabel: 'Awaiting funding',
    amount: 1000,
    currency: 'microUSDC',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ basePath: '', pathname: '/dashboard', query: {}, asPath: '/dashboard', push } as any);
    mockUseConfig.mockReturnValue({ config: { basePath: '' } as any, isLoading: false });
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', email: 'buyer@test.com', walletAddress: '0xBuyer' },
      isLoading: false,
      isConnected: true,
    } as any);
  });

  it('offers the buyer a route to complete the payment', () => {
    render(<ContractActions contract={contract} isBuyer={true} isSeller={false} onAction={jest.fn()} />);

    const button = screen.getByRole('button', { name: /awaiting funding|complete payment/i });
    button.click();

    expect(push).toHaveBeenCalledWith('/contract-pay?contractId=contract-1');
  });

  it('shows the seller a status, not an action', () => {
    render(<ContractActions contract={contract} isBuyer={false} isSeller={true} onAction={jest.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Awaiting funding')).toBeInTheDocument();
  });
});
