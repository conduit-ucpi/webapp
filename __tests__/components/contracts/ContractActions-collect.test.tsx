/**
 * Collecting a released payment: the wallet's own screen is told how much arrives, of what, and
 * for which payment. Left to itself it says only "wants your permission to approve the following
 * transaction".
 */
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn(), query: {}, pathname: '/dashboard', asPath: '/dashboard' }) }));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');

import ContractActions from '@/components/contracts/ContractActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { Contract } from '@/types';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const claimFunds = jest.fn();

const contract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'c1',
    contractAddress: '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B',
    buyerAddress: '0xBuyer',
    sellerAddress: '0xSeller',
    amount: 10_000_000,
    expiryTimestamp: 1700000000,
    description: 'Logo design',
    status: 'EXPIRED',
    ctaType: 'CLAIM_FUNDS',
    ctaLabel: 'Claim Funds',
    tokenAddress: USDT,
    ...overrides,
  }) as Contract;

const collect = async (record: Contract) => {
  render(<ContractActions contract={record} isBuyer={false} isSeller onAction={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Collect funds' }));
  await waitFor(() => expect(claimFunds).toHaveBeenCalled());
  return claimFunds.mock.calls[0];
};

beforeEach(() => {
  claimFunds.mockReset();
  claimFunds.mockResolvedValue('0xhash');
  (useConfig as jest.Mock).mockReturnValue({
    config: {
      chainId: 8453,
      supportedTokens: [
        { symbol: 'USDC', address: USDC, decimals: 6 },
        { symbol: 'USDT', address: USDT, decimals: 6 },
      ],
    },
    isLoading: false,
  });
  (useAuth as jest.Mock).mockReturnValue({ user: { walletAddress: '0xSeller' }, claimFunds, raiseDispute: jest.fn() });
});

describe('collecting a released payment', () => {
  it('says "Collect funds" on the button, whatever the backend calls it', () => {
    render(<ContractActions contract={contract()} isBuyer={false} isSeller onAction={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Collect funds' })).toBeEnabled();
    expect(screen.queryByText('Claim Funds')).toBeNull();
  });

  it("words the wallet's prompt with what arrives, in the payment's own token, and what it was for", async () => {
    const [address, wallet, prompt] = await collect(contract());
    expect(address).toBe('0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B');
    expect(wallet).toBe('0xSeller');
    expect(prompt.decimals).toBe(6);
    // The figure is the contract's own, read when the button is pressed: here 9.7 of the 10 paid.
    expect(prompt.describe('9.7')).toBe('Collect 9.7 USDT from the payment for "Logo design" into your wallet.');
  });

  it('gives no figure when what arrives could not be read', async () => {
    const [, , prompt] = await collect(contract());
    expect(prompt.describe(null)).toBe('Collect the payment for "Logo design" into your wallet.');
  });

  it('gives no figure, and asks for none, when the record does not say which token it holds', async () => {
    const [, , prompt] = await collect(contract({ tokenAddress: undefined }));
    expect(prompt.decimals).toBeUndefined();
    expect(prompt.describe('9.7')).toBe('Collect the payment for "Logo design" into your wallet.');
  });

  it('goes by the symbol when that is all the record has', async () => {
    const [, , prompt] = await collect(contract({ tokenAddress: undefined, currencySymbol: 'usdc' }));
    expect(prompt.describe('9.7')).toBe('Collect 9.7 USDC from the payment for "Logo design" into your wallet.');
  });

  it('keeps a long description short enough to read in a wallet prompt', async () => {
    const [, , prompt] = await collect(contract({ description: 'A'.repeat(100) }));
    expect(prompt.describe(null)).toBe(`Collect the payment for "${'A'.repeat(57)}…" into your wallet.`);
  });
});

describe('raising a dispute', () => {
  it("words both of the wallet's screens: what is disputed, then the split proposed", async () => {
    const raiseDispute = jest.fn().mockResolvedValue('0xhash');
    (useAuth as jest.Mock).mockReturnValue({ user: { walletAddress: '0xBuyer', email: 'buyer@example.com' }, claimFunds, raiseDispute });
    render(
      <ContractActions
        contract={contract({ status: 'ACTIVE', ctaType: 'RAISE_DISPUTE', ctaLabel: 'Raise Dispute' })}
        isBuyer
        isSeller={false}
        onAction={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Raise Dispute' }));
    fireEvent.change(await screen.findByPlaceholderText('Please describe the reason for this dispute...'), { target: { value: 'Never arrived' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '60' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Raise Dispute' }).pop()!);

    await waitFor(() => expect(raiseDispute).toHaveBeenCalled());
    const { prompts } = raiseDispute.mock.calls[0][0];
    expect(prompts.open).toBe(
      'Step 1 of 2: open a dispute on your payment for "Logo design". This stops it being released to the seller on the payout date. No money moves yet.'
    );
    expect(prompts.vote(60)).toBe(
      'Step 2 of 2: record your proposal that 60% is refunded to you and 40% goes to the seller. If the seller or the Third Voter proposes the same split, the payment is paid out that way.'
    );
  });
});
