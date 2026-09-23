import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import DisputeCasePanel from '@/components/admin/DisputeCasePanel';

jest.mock('@/components/ui/LoadingSpinner', () => function MockSpinner() { return <div data-testid="loading-spinner" />; });
jest.mock('@/components/ui/Button', () => function MockButton({ children, ...props }: any) { return <button {...props}>{children}</button>; });
jest.mock('@/components/ui/Input', () => function MockInput(props: any) { return <input {...props} />; });
jest.mock('@/components/ui/ExpandableHash', () => function MockHash({ hash }: { hash: string }) { return <span>{hash}</span>; });
jest.mock('@/utils/validation', () => ({
  displayCurrency: (amount: number) => `$${(amount / 1_000_000).toFixed(2)} USDC`,
  formatDateTimeWithTZ: (ts: number) => `t${ts}`,
}));

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body } as Response);

const detail = (status: string, extra: Partial<any> = {}) => ({
  facts: {
    contractId: 'c1', escrowAddress: '0xabc', description: 'Two blue widgets', currency: 'USDC', amountMicro: 50_000_000, expiryTimestamp: 100, daysPastMaturity: 3,
    filings: [
      { party: 'BUYER', reason: 'One widget arrived, wrong colour', refundPercent: 100, timestamp: 50, wallet: '0xb' },
      { party: 'SELLER', reason: 'Delivered, tracking 1Z999', refundPercent: 0, timestamp: 60, wallet: '0xs' },
    ],
    chain: { status: 'DISPUTED', seated: true, isDefaultArbiter: true, buyerVote: null, sellerVote: 0, arbiterVote: null, consensusReached: false, buyer: '0xb', seller: '0xs' },
    reachability: { BUYER: 'VERIFIED', SELLER: 'UNVERIFIED' },
  },
  disputeCase: {
    status, escrowAddress: '0xabc', openedAt: 1, seatedAt: 2, responseDeadline: 30, holdDeadline: null, action: 'ESCALATE', caseApplied: null, buyerPercentage: null,
    reasoning: 'Both parties have stated positions that do not agree', escalationReason: 'CONTESTED', safeTxHash: null, executionTxHash: null,
    reachability: {}, notices: [{ kind: 'DISPUTE_OPENED', party: 'buyer', recipientWallet: '0xb', channel: 'email', sentAt: 3, messageId: 're_1', outcome: 'sent', deadline: 30 }],
    decisions: [{ at: 31, decider: 'rules', deciderVersion: '1.0.0', action: 'ESCALATE', caseApplied: null, buyerPercentage: null, confidence: 'low', reasoning: 'x', evidenceRelied: [], inputsHash: 'sha256:1' }],
    events: [{ at: 1, type: 'OPENED', detail: null }], version: 3, updatedAt: 31, ...extra,
  },
});

describe('DisputeCasePanel', () => {
  const fetchMock = jest.fn();
  beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock as any; });

  it('shows both sides, reachability, the notices and the record', async () => {
    fetchMock.mockResolvedValueOnce(json(200, detail('HOLD', { buyerPercentage: 40, holdDeadline: 99, escalationReason: null })));
    render(<DisputeCasePanel contractId="c1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('One widget arrived, wrong colour')).toBeTruthy());
    expect(screen.getByText('Delivered, tracking 1Z999')).toBeTruthy();
    expect(screen.getByText('verified email')).toBeTruthy();
    expect(screen.getByText('no verified email')).toBeTruthy();
    expect(screen.getByText('40% buyer / 60% seller')).toBeTruthy();
    expect(screen.getByText(/DISPUTE_OPENED → buyer/)).toBeTruthy();
    expect(screen.queryByText('Decide this case')).toBeNull();
  });

  it('opens a notice to show the email as sent, or says why there is none', async () => {
    fetchMock.mockResolvedValueOnce(json(200, detail('AWAITING_RESPONSE', {
      notices: [
        { kind: 'DISPUTE_OPENED', party: 'buyer', recipientWallet: '0xb', channel: 'email', sentAt: 3, messageId: 're_1', outcome: 'sent', deadline: 30,
          subject: 'Dispute on your escrow: response needed by 9 October', body: '<p>A dispute has been raised.</p>' },
        { kind: 'DISPUTE_OPENED', party: 'seller', recipientWallet: '0xs', channel: 'email', sentAt: 3, messageId: null, outcome: 'no-address', deadline: 30 },
        { kind: 'DEADLINE_REMINDER', party: 'buyer', recipientWallet: '0xb', channel: 'email', sentAt: 4, messageId: 're_0', outcome: 'sent', deadline: 30 },
      ],
    })));
    render(<DisputeCasePanel contractId="c1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/DISPUTE_OPENED → buyer/)).toBeTruthy());

    fireEvent.click(screen.getByText(/DISPUTE_OPENED → buyer/));
    expect(screen.getByText('Dispute on your escrow: response needed by 9 October')).toBeTruthy();
    const frame = screen.getByTitle('DISPUTE_OPENED to buyer') as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toBe('<p>A dispute has been raised.</p>');
    expect(frame.getAttribute('sandbox')).toBe('');

    fireEvent.click(screen.getByText(/DISPUTE_OPENED → seller/));
    expect(screen.getByText(/no verified email address/)).toBeTruthy();
    expect(screen.queryByTitle('DISPUTE_OPENED to buyer')).toBeNull();

    fireEvent.click(screen.getByText(/DEADLINE_REMINDER → buyer/));
    expect(screen.getByText(/Content not recorded/)).toBeTruthy();
  });

  it('an escalated case offers the decision form and posts the reviewer decision', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, detail('ESCALATED')))
      .mockResolvedValueOnce(json(200, { status: 'HOLD' }))
      .mockResolvedValueOnce(json(200, detail('HOLD', { buyerPercentage: 30, escalationReason: null })));
    const onChanged = jest.fn();
    render(<DisputeCasePanel contractId="c1" onClose={() => {}} onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByText('Decide this case')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Buyer percentage'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Reasoning'), { target: { value: 'The tracking shows delivery to the wrong city.' } });
    fireEvent.click(screen.getByText('Record decision'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/api\/admin\/disputes\/c1\/decide$/);
    expect(JSON.parse(init.body)).toEqual({ buyerPercentage: 30, reasoning: 'The tracking shows delivery to the wrong city.' });
    await waitFor(() => expect(screen.getByText('30% buyer / 70% seller')).toBeTruthy());
  });

  it('refuses an invalid percentage or empty reasoning before calling anything', async () => {
    fetchMock.mockResolvedValueOnce(json(200, detail('ESCALATED')));
    render(<DisputeCasePanel contractId="c1" onClose={() => {}} />);
    await waitFor(() => screen.getByText('Decide this case'));
    fireEvent.change(screen.getByLabelText('Buyer percentage'), { target: { value: '101' } });
    fireEvent.click(screen.getByText('Record decision'));
    expect(screen.getByText(/whole number from 0 to 100/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buyer percentage'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Record decision'));
    expect(screen.getByText(/Reasoning is required/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
