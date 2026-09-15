/**
 * When the dashboard offers to re-send a payment link.
 *
 * ⚠️ THE BUG THIS PINS: it used to be gated on `funded`, which is
 *    `item.blockchainFunded || false` — so a row whose chain read did not land read as UNFUNDED
 *    rather than as unknown, and a CLAIMED contract offered to re-send a link for money already
 *    collected. Only on the rows whose read had failed, which is why it looked arbitrary.
 *
 *    The flag could not have worked even when present: the escrow's isFunded() is `_state >= 1`
 *    and a claim moves state to 4, so it stays true. It never meant "still awaiting payment".
 *
 * Gated on the status now, which the record always carries and which needs no chain read at
 * all — CLAIMED is the end of the story and says so by itself.
 */

import { render, screen } from '@testing-library/react';

const mockUser = { walletAddress: '0xSELLER', email: 'seller@test.com' };
jest.mock('@/components/auth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { explorerBaseUrl: 'https://basescan.org' }, isLoading: false }),
}));

import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import type { Contract } from '@/types';

const contract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract-123',
    contractAddress: '0xescrow',
    buyerAddress: '0xBUYER',
    sellerAddress: '0xSELLER',
    amount: 100_000_000,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86_400,
    description: 'Oak dining table',
    status: 'PENDING',
    createdAt: Date.now(),
    funded: false,
    adminNotes: [],
    disputes: [],
    ...overrides,
  }) as Contract;

const show = (overrides: Partial<Contract> = {}) =>
  render(<EnhancedContractCard contract={contract(overrides)} />);

const reshareButton = () => screen.queryByRole('button', { name: /copy payment link/i });

describe('EnhancedContractCard — re-sending the payment link', () => {
  describe('while the request is still awaiting payment', () => {
    it.each(['PENDING', 'PENDING_ACCEPTANCE', 'CREATED', 'AWAITING_FUNDING'])(
      'offers it on %s',
      (status) => {
        show({ status: status as Contract['status'] });

        expect(reshareButton()).toBeInTheDocument();
      }
    );
  });

  describe('once the money has moved', () => {
    it('does not offer it on CLAIMED, even with the chain flag missing', () => {
      // The exact reported case: claimed, and `funded` false because nothing read it.
      show({ status: 'CLAIMED', funded: false });

      expect(reshareButton()).not.toBeInTheDocument();
    });

    it.each(['ACTIVE', 'CLAIMED', 'RESOLVED', 'DISPUTED', 'EXPIRED'])(
      'does not offer it on %s',
      (status) => {
        show({ status: status as Contract['status'] });

        expect(reshareButton()).not.toBeInTheDocument();
      }
    );
  });

  describe('when the status is not something we recognise', () => {
    // An allowlist, so a state we cannot interpret does not inherit the offer. Re-sending a
    // paid request is worse than a missing button.
    it('says nothing on UNKNOWN', () => {
      show({ status: 'UNKNOWN' });

      expect(reshareButton()).not.toBeInTheDocument();
    });

    it('says nothing on ERROR', () => {
      show({ status: 'ERROR' });

      expect(reshareButton()).not.toBeInTheDocument();
    });
  });

  describe('who it is for', () => {
    it('is not offered to the buyer', () => {
      // Delivering the link is the seller's job; a buyer never needs to send it to themselves.
      show({ status: 'PENDING', sellerAddress: '0xSOMEONE_ELSE' });

      expect(reshareButton()).not.toBeInTheDocument();
    });
  });

  it('does not depend on the chain flag at all', () => {
    // Both directions: a funded-looking PENDING still offers it, and that is correct — the
    // status is what decides, and the flag is not consulted.
    show({ status: 'PENDING', funded: true });

    expect(reshareButton()).toBeInTheDocument();
  });
});
