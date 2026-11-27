/**
 * Browsers' CSP reports, as one log line. Public, so what matters is what it refuses to log.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/telemetry/csp-report';

let address = 0;

const post = (body: unknown) => {
  const { req, res } = createMocks({
    method: 'POST',
    body: body as any,
    headers: { 'x-forwarded-for': `203.0.113.${(address += 1)}` },
  });
  handler(req as any, res as any);
  return res;
};

const report = (fields: Record<string, unknown>) => ({
  'csp-report': {
    'document-uri': 'https://stabledrop.me/contract-pay/?contract=secret',
    'effective-directive': 'connect-src',
    'blocked-uri': 'https://stats.example/collect?cid=123',
    ...fields,
  },
});

describe('POST /api/telemetry/csp-report', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('logs the directive, and only the origin and path of each URL', () => {
    expect(post(report({}))._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledWith(
      'CSP VIOLATION connect-src: blocked https://stats.example on https://stabledrop.me/contract-pay/'
    );
  });

  it('reads the unparsed body browsers send as application/csp-report', () => {
    expect(post(JSON.stringify(report({})))._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('names an inline violation by keyword', () => {
    post(report({ 'blocked-uri': 'inline', 'effective-directive': 'script-src-elem' }));
    expect(log.mock.calls[0][0]).toContain('script-src-elem: blocked inline on');
  });

  it('cannot be made to forge a log line', () => {
    post(report({ 'blocked-uri': 'x\nCSP VIOLATION forged', 'effective-directive': 'a\nb', 'document-uri': 'nope\nforged' }));
    expect(log.mock.calls[0][0]).toBe('CSP VIOLATION a: blocked other on unknown');
  });

  it('drops reports caused by browser extensions', () => {
    expect(post(report({ 'source-file': 'chrome-extension://abc/inject.js' }))._getStatusCode()).toBe(204);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([[{}], ['not json'], [{ 'csp-report': 'nope' }]])('refuses %j', (body) => {
    expect(post(body)._getStatusCode()).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it('refuses anything but POST', () => {
    const { req, res } = createMocks({ method: 'GET' });
    handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
