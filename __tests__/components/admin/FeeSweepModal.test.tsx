import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import FeeSweepModal from '@/components/admin/FeeSweepModal';

jest.mock('@/components/ui/LoadingSpinner', () => function MockSpinner() { return <div data-testid="loading-spinner" />; });
jest.mock('@/components/ui/Button', () => function MockButton({ children, ...props }: any) { return <button {...props}>{children}</button>; });
jest.mock('@/components/ui/Input', () => function MockInput({ label, ...props }: any) { return <input aria-label={label} {...props} />; });
jest.mock('@/components/ui/Modal', () => function MockModal({ isOpen, children }: any) { return isOpen ? <div>{children}</div> : null; });

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body } as Response);

const escrow = '0xE0b241AbfCfb942A77d01dc24478526AE3aC95c8';
const a1 = '0x1111111111111111111111111111111111111111';

describe('FeeSweepModal', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    window.confirm = jest.fn(() => true);
  });

  const fill = () => {
    fireEvent.change(screen.getByLabelText('Escrow contract address'), { target: { value: escrow } });
    fireEvent.change(screen.getByLabelText('Address 1'), { target: { value: a1 } });
  };

  it('posts the form and shows the transaction', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {
      success: true, feeAmount: '300000', tokenAddress: '0xusdc', transactionHash: '0xhash',
      payments: [{ target: a1, bps: 10000, amount: '300000' }]
    }));
    render(<FeeSweepModal isOpen onClose={() => {}} />);
    fill();
    fireEvent.click(screen.getByText('Sweep Fee'));
    await waitFor(() => expect(screen.getByText('Tx: 0xhash')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/sweep-fees');
    expect(JSON.parse(init.body)).toEqual({ contractAddress: escrow, target1: a1, bps1: '10000', target2: '', bps2: '0' });
  });

  it("shows chainservice's error", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { success: false, error: 'No fee to sweep' }));
    render(<FeeSweepModal isOpen onClose={() => {}} />);
    fill();
    fireEvent.click(screen.getByText('Sweep Fee'));
    await waitFor(() => expect(screen.getByText('No fee to sweep')).toBeTruthy());
  });

  it('sends nothing when the confirmation is declined', () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    render(<FeeSweepModal isOpen onClose={() => {}} />);
    fill();
    fireEvent.click(screen.getByText('Sweep Fee'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
