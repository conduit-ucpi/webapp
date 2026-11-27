/**
 * Coinbase sending a buyer back, as one log line. Public, so what matters is what it refuses to log.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/coinbase/onramp-returned';

const post = (query: Record<string, string>) =>
  createMocks({ method: 'POST', query, headers: { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}` } });

describe('POST /api/coinbase/onramp-returned', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('logs the contract and answers 204', () => {
    const { req, res } = post({ contract: '6aed2961fb90e006e8538f7d' });
    handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledWith('COINBASE ONRAMP RETURNED: contract 6aed2961fb90e006e8538f7d');
  });

  it('logs "none" rather than anything that could forge a line', () => {
    const { req, res } = post({ contract: 'x\nCOINBASE ONRAMP RETURNED: contract fake' });
    handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledWith('COINBASE ONRAMP RETURNED: contract none');
  });

  it('refuses anything but POST', () => {
    const { req, res } = createMocks({ method: 'GET' });
    handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(log).not.toHaveBeenCalled();
  });
});
