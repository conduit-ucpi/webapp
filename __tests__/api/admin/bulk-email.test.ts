/**
 * /api/admin/bulk-email: one email to one address, for admins only, sent through emailservice
 * with the admin's own session (emailservice checks admin again).
 */
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler, { plainTextToHtml } from '@/pages/api/admin/bulk-email';

const fetchMock = jest.fn();
const emailCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/email/send'));

function services(identity: { userType: string } | null, emailStatus = 200) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/api/user/identity')) {
      return identity ? { ok: true, status: 200, json: async () => identity } : { ok: false, status: 401, json: async () => ({}) };
    }
    return {
      ok: emailStatus < 300,
      status: emailStatus,
      json: async () => (emailStatus < 300 ? { success: true, messageId: 'm1' } : { success: false, message: 'nope' }),
    };
  });
}

async function call(body: Record<string, unknown>, signedIn = true, method: 'POST' | 'GET' = 'POST') {
  const { req, res } = createMocks({ method, body: body as any, headers: signedIn ? { cookie: 'AUTH-TOKEN=tok' } : {} });
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

const good = { to: 'someone@example.com', subject: 'Hello', body: 'Line one\nline two\n\nPara <b>two</b>' };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as any;
  process.env.USER_SERVICE_URL = 'http://userservice';
  process.env.EMAIL_SERVICE_URL = 'http://emailservice:8979';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('who may send', () => {
  it('refuses a caller with no session, asking nothing of any service', async () => {
    services({ userType: 'admin' });
    expect((await call(good, false))._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a signed-in non-admin before emailservice is reached', async () => {
    services({ userType: 'normal' });
    expect((await call(good))._getStatusCode()).toBe(403);
    expect(emailCalls()).toHaveLength(0);
  });

  it('refuses a token userservice does not recognise', async () => {
    services(null);
    expect((await call(good))._getStatusCode()).toBe(401);
    expect(emailCalls()).toHaveLength(0);
  });

  it('refuses anything but POST', async () => {
    services({ userType: 'admin' });
    expect((await call(good, true, 'GET'))._getStatusCode()).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('an admin sending', () => {
  it('sends one email with the admin session forwarded and the body escaped', async () => {
    services({ userType: 'admin' });
    const res = await call(good);
    expect(res._getStatusCode()).toBe(200);
    expect(emailCalls()).toHaveLength(1);
    const [url, init] = emailCalls()[0];
    expect(url).toBe('http://emailservice:8979/api/email/send');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-API-KEY']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      to: 'someone@example.com',
      subject: 'Hello',
      content: '<p>Line one<br>line two</p><p>Para &lt;b&gt;two&lt;/b&gt;</p>',
      isHtml: true,
    });
  });

  it.each([
    ['a bad address', { ...good, to: 'not-an-email' }],
    ['several addresses in one call', { ...good, to: 'a@x.com,b@y.com' }],
    ['a missing subject', { ...good, subject: ' ' }],
    ['a subject with a line break (header injection)', { ...good, subject: 'Hi\r\nBcc: x@y.com' }],
    ['an empty body', { ...good, body: '' }],
  ])('rejects %s without sending', async (_name, body) => {
    services({ userType: 'admin' });
    expect((await call(body))._getStatusCode()).toBe(400);
    expect(emailCalls()).toHaveLength(0);
  });

  it('passes emailservice refusing the admin through as 403', async () => {
    services({ userType: 'admin' }, 403);
    const res = await call(good);
    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData()).error).toBe('nope');
  });

  it('reports an emailservice failure as 502', async () => {
    services({ userType: 'admin' }, 500);
    expect((await call(good))._getStatusCode()).toBe(502);
  });
});

describe('plainTextToHtml', () => {
  it('turns CRLF text into paragraphs and breaks', () => {
    expect(plainTextToHtml('a\r\nb\r\n\r\n\r\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });
});
