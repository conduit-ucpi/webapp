/**
 * A payment link being opened, as one log line. Public, so what matters is what it refuses to log
 * and that it answers the same whatever the id.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/contracts/[id]/link-opened';

const ID = '6aec3ebd01a76609027a054b';

const post = (id: string, address: string) =>
  createMocks({ method: 'POST', query: { id }, headers: { 'x-forwarded-for': address } });

describe('POST /api/contracts/[id]/link-opened', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('logs the contract id and answers 204 with no session', () => {
    const { req, res } = post(ID, '203.0.113.1');
    handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(`PAYMENT LINK OPENED: contract ${ID}`);
  });

  it.each(['abc\nPAYMENT LINK OPENED: contract forged', '../admin/x', '', 'a'.repeat(65)])(
    'refuses %j without logging it',
    (id) => {
      const { req, res } = post(id, '203.0.113.2');
      handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(log).not.toHaveBeenCalled();
    }
  );

  it('accepts only POST', () => {
    const { req, res } = createMocks({ method: 'GET', query: { id: ID } });
    handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    expect(log).not.toHaveBeenCalled();
  });

  it('stops logging one address past the limit, still answering 204, and not another', () => {
    for (let i = 0; i < 120; i++) {
      const { req, res } = post(ID, '203.0.113.3');
      handler(req as any, res as any);
    }
    expect(log).toHaveBeenCalledTimes(120);

    const over = post(ID, '203.0.113.3');
    handler(over.req as any, over.res as any);
    expect(over.res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledTimes(120);

    const other = post(ID, '203.0.113.4');
    handler(other.req as any, other.res as any);
    expect(log).toHaveBeenCalledTimes(121);
  });
});
