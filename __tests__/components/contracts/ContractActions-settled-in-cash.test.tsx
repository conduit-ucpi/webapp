import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');

import { useRouter } from 'next/router';
import ContractActions from '@/components/contracts/ContractActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { SETTLED_IN_CASH_REASON } from '@/lib/cashSettlement';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

/**
 * "I settled in cash" is the ordinary dispute path with its two arguments fixed: the sentinel
 * reason (which the seller's screen and disputeservice both match on, so it must be the exact
 * exported string, not a translation) and a 100% figure. It sits behind a confirmation because it
 * fires two wallet transactions and freezes the seller's money.
 */
describe('ContractActions - I settled in cash', () => {
  const raiseDispute = jest.fn();

  const contract = {
    id: 'contract-1',
    contractAddress: '0xescrow',
    status: 'ACTIVE',
    ctaType: 'RAISE_DISPUTE',
    ctaLabel: 'Raise Dispute',
    amount: 1_000_000,
    currency: 'microUSDC',
    buyerEmail: 'buyer@test.com',
    sellerEmail: 'seller@test.com',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    raiseDispute.mockResolvedValue('0xtxhash');
    mockUseRouter.mockReturnValue({ basePath: '', pathname: '/dashboard', query: {}, asPath: '/dashboard', push: jest.fn() } as any);
    mockUseConfig.mockReturnValue({ config: { basePath: '' } as any, isLoading: false });
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', email: 'buyer@test.com', walletAddress: '0xBuyer' },
      isLoading: false,
      isConnected: true,
      raiseDispute,
    } as any);
  });

  it('raises the dispute at 100% with the exact sentinel reason, after confirmation', async () => {
    render(<ContractActions contract={contract} isBuyer={true} isSeller={false} onAction={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'I settled in cash' }));
    // Nothing is sent by the first click: the dialog explains that the seller must still agree.
    expect(raiseDispute).not.toHaveBeenCalled();
    expect(screen.getByText(/Nothing is refunded on your word alone/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, raise it' }));

    await waitFor(() => expect(raiseDispute).toHaveBeenCalledTimes(1));
    expect(raiseDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddress: '0xescrow',
        reason: SETTLED_IN_CASH_REASON,
        refundPercent: 100,
      })
    );
    expect(SETTLED_IN_CASH_REASON).toBe('I settled in cash');
  });

  it('can be cancelled without sending anything', () => {
    render(<ContractActions contract={contract} isBuyer={true} isSeller={false} onAction={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'I settled in cash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(raiseDispute).not.toHaveBeenCalled();
  });

  it('is not offered to the seller', () => {
    render(<ContractActions contract={contract} isBuyer={false} isSeller={true} onAction={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'I settled in cash' })).toBeNull();
  });

  it('leaves the ordinary Raise Dispute button in place', () => {
    render(<ContractActions contract={contract} isBuyer={true} isSeller={false} onAction={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Raise Dispute' })).toBeInTheDocument();
  });
});
