/**
 * Funding steps only the browser sees, as one log line. Public, so what matters is what it refuses
 * to log.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/funding-event';

const WALLET = '0x6e186283dc6d5e45b88f50476f66aba5a947c9f4';
let address = 0;

const post = (body: Record<string, unknown>) => {
  const { req, res } = createMocks({
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `203.0.113.${(address += 1)}` },
  });
  handler(req as any, res as any);
  return res;
};

describe('POST /api/funding-event', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('logs the step, with the wallet masked as the Kotlin services mask it', () => {
    const res = post({ event: 'privy-failed', contract: 'req-1', wallet: WALLET, amount: '15.00', locale: 'es-US', country: 'VE', detail: 'No quotes' });
    expect(res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledWith(
      'FUNDING EVENT privy-failed: contract req-1 wallet 0x6e18***c9f4 amount 15.00 locale es-US country VE detail "No quotes"'
    );
  });

  it('refuses an event it does not know, and logs nothing', () => {
    expect(post({ event: 'FUNDING EVENT fake' })._getStatusCode()).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs placeholders for fields of the wrong shape', () => {
    post({ event: 'transfer-opened', contract: 'x\ny', wallet: 'nope', amount: '1; rm', locale: 'es US', country: 'x\ny' });
    expect(log).toHaveBeenCalledWith('FUNDING EVENT transfer-opened: contract none wallet unknown amount unknown locale unknown country unknown detail ""');
  });

  it('keeps a provider message to one short line, without emails', () => {
    post({ event: 'privy-failed', detail: `bad\nFUNDING EVENT fake for me@example.com ${'x'.repeat(400)}` });
    const line = String(log.mock.calls[0][0]);
    expect(line.split('\n')).toHaveLength(1);
    expect(line).not.toContain('me@example.com');
    expect(line.length).toBeLessThan(320);
  });

  it('refuses anything but POST', () => {
    const { req, res } = createMocks({ method: 'GET' });
    handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
