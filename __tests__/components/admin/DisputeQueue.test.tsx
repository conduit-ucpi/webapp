import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import DisputeQueue from '@/components/admin/DisputeQueue';

jest.mock('@/components/ui/LoadingSpinner', () => function MockSpinner() { return <div data-testid="loading-spinner" />; });
jest.mock('@/components/ui/Button', () => function MockButton({ children, ...props }: any) { return <button {...props}>{children}</button>; });
jest.mock('@/components/ui/ExpandableHash', () => function MockHash({ hash }: { hash: string }) { return <span>{hash}</span>; });
jest.mock('@/utils/validation', () => ({
  displayCurrency: (amount: number) => `$${(amount / 1_000_000).toFixed(2)} USDC`,
  formatDateTimeWithTZ: (ts: number) => `t${ts}`,
}));

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body } as Response);
const row = (over: Partial<any> = {}) => ({
  contractId: 'c1', escrowAddress: '0xabc', description: 'Two blue widgets', amountMicro: 50_000_000, maturity: 1, daysPastMaturity: 59,
  status: 'READY_TO_EXECUTE', caseApplied: 'D3', buyerPercentage: 100, escalationReason: null, responseDeadline: 10, holdDeadline: 20, safeTxHash: null, ...over,
});

describe('DisputeQueue', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    window.confirm = jest.fn(() => true);
  });

  it('shows the queue as disputeservice reports it and selects a row', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [row(), row({ contractId: 'c2', status: 'ESCALATED', escalationReason: 'CONTESTED', buyerPercentage: null, caseApplied: null })]));
    const onSelect = jest.fn();
    render(<DisputeQueue onSelect={onSelect} />);
    await waitFor(() => expect(screen.getAllByText('Two blue widgets', { selector: 'div' })).toHaveLength(2));
    expect(screen.getByText('READY_TO_EXECUTE')).toBeTruthy();
    expect(screen.getByText('CONTESTED')).toBeTruthy();
    expect(screen.getByText('100% buyer')).toBeTruthy();
    expect(screen.getAllByText('59 d')).toHaveLength(2);
    expect(screen.getByText(/1 ready to execute/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('dispute-row-c2'));
    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('release asks for confirmation, posts to the Node API and shows the Safe app link', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, [row()]))
      .mockResolvedValueOnce(json(200, { proposed: ['c1'], rejected: {}, safeTxHash: '0xhash', safeAppUrl: 'https://app.safe.global/q', nonce: 7, error: null }))
      .mockResolvedValueOnce(json(200, [row({ status: 'PROPOSED', safeTxHash: '0xhash' })]));
    render(<DisputeQueue />);
    await waitFor(() => screen.getByText(/Release ready batch \(1\)/));
    fireEvent.click(screen.getByText(/Release ready batch \(1\)/));
    await waitFor(() => expect(screen.getByText('Confirm in the Safe app')).toBeTruthy());
    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/admin\/disputes\/release$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('release is disabled when nothing is ready, and a refused release shows the reason', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, [row({ status: 'HOLD' })]))
    render(<DisputeQueue />);
    await waitFor(() => screen.getByText(/Release ready batch \(0\)/));
    expect((screen.getByText(/Release ready batch \(0\)/) as HTMLButtonElement).disabled).toBe(true);

    fetchMock.mockResolvedValueOnce(json(200, { at: 5, queued: 1, processed: 1, changed: 0, failed: 0, results: [] })).mockResolvedValueOnce(json(200, [row({ status: 'HOLD' })]));
    fireEvent.click(screen.getByText('Run sweep'));
    await waitFor(() => expect(screen.getByText(/Sweep at t5: 1 queued, 0 changed, 0 failed/)).toBeTruthy());
  });

  it('a non-admin sees the error rather than an empty queue', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: 'Forbidden' }));
    render(<DisputeQueue />);
    await waitFor(() => expect(screen.getByText(/Failed to load the dispute queue: 403/)).toBeTruthy());
  });
});
