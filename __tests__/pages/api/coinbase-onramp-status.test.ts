/**
 * /api/coinbase/onramp-status: asks Coinbase how the signed-in buyer's card purchases stand and
 * writes it to the log. The page always gets a 204; only the log changes.
 */
import { createMocks } from 'node-mocks-http';
import handler, { allow, recentPurchases } from '@/pages/api/coinbase/onramp-status';
import { cdpRequest, fetchIdentity, getCdpCredentials } from '@/lib/server/coinbaseCdp';
import { requireAuth } from '@/utils/api-auth';

jest.mock('@/lib/server/coinbaseCdp', () => ({
  cdpRequest: jest.fn(),
  fetchIdentity: jest.fn(),
  getCdpCredentials: jest.fn(),
}));
jest.mock('@/utils/api-auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/server/publicFormLimit', () => ({
  clientAddress: () => '203.0.113.1',
  rateLimiter: () => jest.fn(() => true),
}));

const NOW = Date.parse('2026-11-25T12:00:00Z');
const purchase = (overrides: Record<string, unknown> = {}) => ({
  transaction_id: 'tx-1',
  status: 'ONRAMP_TRANSACTION_STATUS_IN_PROGRESS',
  purchase_currency: 'USDC',
  purchase_network: 'base',
  purchase_amount: { value: '20.00', currency: 'USDC' },
  payment_total: { value: '21.10', currency: 'USD' },
  payment_method: 'CARD',
  created_at: new Date(NOW - 5 * 60_000).toISOString(),
  ...overrides,
});

const call = async (method = 'POST', query: Record<string, string> = { trigger: 'closed', contract: '6b0667d6c3c6f2734bc08613' }) => {
  const { req, res } = createMocks({ method: method as 'POST', query });
  await handler(req as any, res as any);
  return res;
};

describe('POST /api/coinbase/onramp-status', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    (allow as jest.Mock).mockReturnValue(true);
    (getCdpCredentials as jest.Mock).mockReturnValue({ apiKeyId: 'k', apiKeySecret: 's' });
    (requireAuth as jest.Mock).mockReturnValue('token');
    (fetchIdentity as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (cdpRequest as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ transactions: [purchase()] }),
    });
  });
  afterEach(() => {
    log.mockRestore();
    jest.useRealTimers();
  });

  it("logs the buyer's recent purchases at Coinbase, with their status", async () => {
    const res = await call();
    expect(res._getStatusCode()).toBe(204);
    expect(cdpRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', path: '/onramp/v1/buy/user/user-1/transactions' }));
    const line = String(log.mock.calls[0][0]);
    expect(line).toMatch(/^COINBASE ONRAMP STATUS: user user-1 contract 6b0667d6c3c6f2734bc08613 trigger closed latest IN_PROGRESS purchases /);
    expect(JSON.parse(line.split(' purchases ')[1])).toEqual([
      expect.objectContaining({ id: 'tx-1', status: 'IN_PROGRESS', amount: '20.00 USDC', paid: '21.10 USD', method: 'CARD', sent: false }),
    ]);
  });

  it('masks a wallet used as the user ref, as the other logs do', async () => {
    (fetchIdentity as jest.Mock).mockResolvedValue({ walletAddress: '0x1234567890abcdef1234567890abcdef12345678' });
    await call();
    expect(String(log.mock.calls[0][0])).toContain('user 0x1234***5678 ');
  });

  it('says so when signed out, without asking Coinbase', async () => {
    (requireAuth as jest.Mock).mockImplementation(() => {
      throw new Error('Authentication required');
    });
    expect((await call())._getStatusCode()).toBe(204);
    expect(cdpRequest).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toContain('unknown (signed out)');
  });

  it("answers 204 and logs the failure when Coinbase refuses", async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    (cdpRequest as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' });
    expect((await call())._getStatusCode()).toBe(204);
    expect(error).toHaveBeenCalledWith('COINBASE ONRAMP STATUS lookup failed:', { status: 401, body: 'nope' });
    error.mockRestore();
  });

  it('logs a trigger or contract of the wrong shape as a placeholder', async () => {
    await call('POST', { trigger: 'x\ny', contract: 'a b' });
    expect(String(log.mock.calls[0][0])).toContain('contract none trigger unknown ');
  });

  it('refuses anything but POST', async () => {
    expect((await call('GET'))._getStatusCode()).toBe(405);
  });
});

describe('recentPurchases', () => {
  it('keeps the last day, newest first, and the failure reason when Coinbase gives one', () => {
    const list = recentPurchases(
      [
        purchase({ transaction_id: 'old', created_at: new Date(NOW - 2 * 86_400_000).toISOString() }),
        purchase({ transaction_id: 'earlier', created_at: new Date(NOW - 60 * 60_000).toISOString() }),
        purchase({ transaction_id: 'failed', status: 'ONRAMP_TRANSACTION_STATUS_FAILED', failure_reason: 'card declined' }),
      ],
      NOW
    );
    expect(list.map((tx) => [tx.id, tx.status, tx.failure])).toEqual([
      ['failed', 'FAILED', 'card declined'],
      ['earlier', 'IN_PROGRESS', undefined],
    ]);
  });
});
