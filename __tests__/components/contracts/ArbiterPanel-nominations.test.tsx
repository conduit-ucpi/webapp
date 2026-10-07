/**
 * Whose nomination is whose, on the arbiter seat a sale emptied.
 *
 * ⚠️ THE BUG THIS PINS. "The other party's nomination" was `nominatedByBuyer ||
 *    nominatedByRecipient` — not the other party at all, but "the buyer's, else the
 *    recipient's", whoever happened to be looking. For a BUYER who had already nominated it
 *    returned their OWN choice, so re-nominating that same candidate reported "Nominations
 *    matched — that arbiter is now seated" when it had seated nobody. A false claim about who
 *    gets to decide their dispute.
 *
 * Naming the same address IS the agreement — it seats in that transaction — so showing the
 * other side's choice is most of what makes the seat re-fillable at all.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const nominateArbiter = jest.fn();
const resolveArbiterEmail = jest.fn();

jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    nominateArbiter,
    resolveArbiterEmail,
    evictArbiter: jest.fn(),
    seatDefaultArbiter: jest.fn(),
  }),
}));

import ArbiterPanel from '@/components/contracts/ArbiterPanel';
import type { ArbiterState } from '@/types/marketplace';

const BUYERS_PICK = '0xbbbb000000000000000000000000000000000001';
const RECIPIENTS_PICK = '0xcccc000000000000000000000000000000000002';

const state = (overrides: Partial<ArbiterState> = {}): ArbiterState =>
  ({
    contractAddress: '0xescrow',
    cohort: 'MARKETPLACE',
    arbiter: null,
    seated: false,
    sold: true,
    resolvedBuyerPercentage: null,
    nominationDeadline: null,
    nominationWindowSeconds: 72 * 3600,
    nominatedByBuyer: null,
    nominatedByRecipient: null,
    nominationsMatch: false,
    lastArbiterActionAt: null,
    evictableAt: null,
    canNominate: true,
    canSeatDefaultArbiter: false,
    canEvictArbiter: false,
    ...overrides,
  }) as ArbiterState;

const show = (s: Partial<ArbiterState>, viewerRole: 'buyer' | 'recipient' | null) =>
  render(
    <ArbiterPanel
      contractAddress="0xescrow"
      state={state(s)}
      loading={false}
      onChanged={jest.fn()}
      viewerRole={viewerRole}
    />
  );

describe('showing what the other party suggested', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the recipient their counterparty’s pick', () => {
    show({ nominatedByBuyer: BUYERS_PICK }, 'recipient');

    expect(screen.getByText('The other party has suggested:')).toBeInTheDocument();
    expect(screen.getByText(BUYERS_PICK)).toBeInTheDocument();
  });

  it('shows the buyer their counterparty’s pick', () => {
    // The mirror case, which the old `buyer || recipient` fallback got wrong.
    show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

    expect(screen.getByText('The other party has suggested:')).toBeInTheDocument();
    expect(screen.getByText(RECIPIENTS_PICK)).toBeInTheDocument();
  });

  it('does not present the buyer’s own nomination as the other party’s', () => {
    // The exact misread: buyer has nominated, recipient has not. There is no counterparty
    // suggestion to show, and claiming one invites them to "agree" with themselves.
    show({ nominatedByBuyer: BUYERS_PICK }, 'buyer');

    expect(screen.queryByText('The other party has suggested:')).not.toBeInTheDocument();
    expect(screen.getByText('You have suggested:')).toBeInTheDocument();
  });

  it('tells a party who has nominated that they are waiting on the other side', () => {
    show({ nominatedByRecipient: RECIPIENTS_PICK }, 'recipient');

    expect(
      screen.getByText('They are seated as soon as the other party names the same address.')
    ).toBeInTheDocument();
  });

  it('shows both sides when both have named someone', () => {
    show({ nominatedByBuyer: BUYERS_PICK, nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

    expect(screen.getByText(RECIPIENTS_PICK)).toBeInTheDocument(); // theirs
    expect(screen.getByText(BUYERS_PICK)).toBeInTheDocument(); // mine
  });

  describe('when we cannot place the viewer', () => {
    it('names both sides rather than calling either one theirs', () => {
      // An observer, or a wallet matching neither party. Guessing here would label one
      // party's choice as the counterparty's on a safety-critical screen.
      show({ nominatedByBuyer: BUYERS_PICK, nominatedByRecipient: RECIPIENTS_PICK }, null);

      expect(screen.getByText(/Already nominated/)).toBeInTheDocument();
      expect(screen.queryByText('The other party has suggested:')).not.toBeInTheDocument();
    });
  });
});

describe('agreeing to their suggestion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fills the field rather than nominating outright', () => {
    /*
     * ⚠️ DELIBERATELY NOT ONE CLICK. A match seats that arbiter in the same transaction and
     *    cannot be undone, and the panel's own warning says there is no register of approved
     *    arbiters and no check on who the address belongs to. A one-press "agree" is exactly
     *    the attack: the other side names their confederate and the button consents.
     */
    show({ nominatedByBuyer: BUYERS_PICK }, 'recipient');

    expect(screen.getByRole('button', { name: /use this address/i })).toBeInTheDocument();
    expect(nominateArbiter).not.toHaveBeenCalled();
  });

  it('puts their address in the field, ready to be sent deliberately', async () => {
    show({ nominatedByBuyer: BUYERS_PICK }, 'recipient');

    await userEvent.click(screen.getByRole('button', { name: /use this address/i }));

    expect(screen.getByLabelText(/nominate a tiebreaker/i)).toHaveValue(BUYERS_PICK);
    expect(nominateArbiter).not.toHaveBeenCalled();
  });

  it('still keeps the warning about who the address belongs to', () => {
    show({ nominatedByBuyer: BUYERS_PICK }, 'recipient');

    expect(screen.getByText(/no register of approved tiebreakers/i)).toBeInTheDocument();
  });
});

describe('naming a tiebreaker by email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveArbiterEmail.mockReset();
  });

  const MEDIATORS_WALLET = '0xdddd000000000000000000000000000000000003';

  it('looks the email up and nominates the wallet it names', async () => {
    resolveArbiterEmail.mockResolvedValue(MEDIATORS_WALLET);
    nominateArbiter.mockResolvedValue(undefined);
    show({}, 'buyer');

    await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Nominate' }));

    await waitFor(() => expect(nominateArbiter).toHaveBeenCalledWith('0xescrow', MEDIATORS_WALLET));
    expect(resolveArbiterEmail).toHaveBeenLastCalledWith('mediator@example.com', { create: true });
    expect(await screen.findByText(/Nomination recorded for mediator@example.com/)).toBeInTheDocument();
  });

  it('reports a match when the email names the wallet the other party already nominated', async () => {
    resolveArbiterEmail.mockResolvedValue(RECIPIENTS_PICK);
    nominateArbiter.mockResolvedValue(undefined);
    show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

    await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Nominate' }));

    expect(await screen.findByText('Nominations matched — that tiebreaker is now seated.')).toBeInTheDocument();
  });

  it('nominates nobody when the email cannot be looked up, and says why', async () => {
    resolveArbiterEmail.mockRejectedValue(new Error('Could not look up that email right now. Try again, or use a wallet address.'));
    show({}, 'buyer');

    await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Nominate' }));

    expect(await screen.findByText(/Could not look up that email/)).toBeInTheDocument();
    expect(nominateArbiter).not.toHaveBeenCalled();
  });

  it('does not look anything up for a wallet address', async () => {
    nominateArbiter.mockResolvedValue(undefined);
    show({}, 'buyer');

    await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), MEDIATORS_WALLET);
    await userEvent.click(screen.getByRole('button', { name: 'Nominate' }));

    await waitFor(() => expect(nominateArbiter).toHaveBeenCalledWith('0xescrow', MEDIATORS_WALLET));
    expect(resolveArbiterEmail).not.toHaveBeenCalled();
  });

  it('will not nominate something that is neither', async () => {
    show({}, 'buyer');

    await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator');

    expect(screen.getByRole('button', { name: 'Nominate' })).toBeDisabled();
    expect(screen.getByText('That is not a valid wallet address or email address.')).toBeInTheDocument();
  });

  describe('the live lookup, before anything is nominated', () => {
    it('shows the wallet the email names, looking up only, never creating', async () => {
      resolveArbiterEmail.mockResolvedValue(MEDIATORS_WALLET);
      show({}, 'buyer');

      await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator@example.com');

      expect(await screen.findByText(MEDIATORS_WALLET)).toBeInTheDocument();
      expect(screen.getByText(/mediator@example.com has the StableDrop wallet/)).toBeInTheDocument();
      expect(resolveArbiterEmail).toHaveBeenCalledWith('mediator@example.com', { create: false });
      expect(resolveArbiterEmail).not.toHaveBeenCalledWith(expect.anything(), { create: true });
      expect(nominateArbiter).not.toHaveBeenCalled();
    });

    it('tells the second party their email is the other party’s pick, before they nominate', async () => {
      resolveArbiterEmail.mockResolvedValue(RECIPIENTS_PICK);
      show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

      expect(screen.getByText(/type that person's email below/)).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'mediator@example.com');

      expect(await screen.findByText(/This is the person the other party suggested/)).toBeInTheDocument();
      expect(nominateArbiter).not.toHaveBeenCalled();
    });

    it('says when the email is somebody else', async () => {
      resolveArbiterEmail.mockResolvedValue(MEDIATORS_WALLET);
      show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

      await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'someone@example.com');

      expect(await screen.findByText('This is not the person the other party suggested.')).toBeInTheDocument();
    });

    it('says a wallet will be made for an email nobody has signed in with', async () => {
      resolveArbiterEmail.mockResolvedValue(null);
      show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

      await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), 'new@example.com');

      expect(await screen.findByText(/new@example.com has not signed in to StableDrop yet/)).toBeInTheDocument();
      expect(screen.getByText('This is not the person the other party suggested.')).toBeInTheDocument();
    });

    it('shows a match for a pasted wallet address too, with no lookup', async () => {
      show({ nominatedByRecipient: RECIPIENTS_PICK }, 'buyer');

      await userEvent.type(screen.getByLabelText(/nominate a tiebreaker/i), RECIPIENTS_PICK);

      expect(screen.getByText(/This is the person the other party suggested/)).toBeInTheDocument();
      expect(resolveArbiterEmail).not.toHaveBeenCalled();
    });
  });
});
