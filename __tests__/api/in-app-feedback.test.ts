/**
 * The in-app feedback route: public, rate-limited, forwarding only the fields emailservice takes,
 * with the signed-in account looked up from userservice rather than taken from the browser.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/in-app-feedback';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const BODY = { contactEmail: 'ana@example.com', message: 'It broke', pageUrl: 'https://stabledrop.me/dashboard' };
const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

let ip = 0;
const call = async (body: unknown, headers: Record<string, string> = {}) => {
  ip += 1;
  const { req, res } = createMocks({
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `10.1.0.${ip}`, 'user-agent': 'TestAgent/1', ...headers },
  });
  await handler(req as any, res as any);
  return res;
};

const emailCall = () => fetchMock.mock.calls.find(([url]) => String(url).includes('/api/email/'))!;
const sentBody = () => JSON.parse(emailCall()[1].body);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith('/api/user/identity')
      ? { ok: true, status: 200, json: async () => ({ userId: 'u1', email: 'ana.account@example.com', walletAddress: WALLET }) }
      : { ok: true, status: 200, text: async () => '{"success":true}' }
  );
  process.env.EMAIL_SERVICE_URL = 'http://emailservice:8979';
  process.env.TO_EMAILSERVICE_API_KEY = 'to-email-key';
  process.env.USER_SERVICE_URL = 'http://userservice:8977';
});

it("sends it to emailservice with this app's key, the page, and the visitor's browser", async () => {
  const res = await call(BODY);
  expect(res._getStatusCode()).toBe(200);
  const [url, init] = emailCall();
  expect(url).toBe('http://emailservice:8979/api/email/in-app-feedback');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-KEY': 'to-email-key' });
  expect(sentBody()).toEqual({ ...BODY, walletAddress: null, accountEmail: null, userAgent: 'TestAgent/1' });
});

it('attaches the signed-in account as userservice reports it, asked with only the visitor session', async () => {
  await call(BODY, { cookie: 'AUTH-TOKEN=visitor', 'x-forwarded-host': 'evil.example' });
  const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/api/user/identity'))!;
  expect(url).toBe('http://userservice:8977/api/user/identity');
  expect(init.headers).toEqual({ Cookie: 'AUTH-TOKEN=visitor', Authorization: 'Bearer visitor' });
  expect(sentBody()).toMatchObject({ walletAddress: WALLET, accountEmail: 'ana.account@example.com' });
});

it('ignores any account, recipient or extra field the browser sends', async () => {
  await call({ ...BODY, walletAddress: '0xspoof', accountEmail: 'ceo@stabledrop.me', to: 'victim@elsewhere.example' });
  const sent = sentBody();
  expect(sent.walletAddress).toBeNull();
  expect(sent.accountEmail).toBeNull();
  expect(sent).not.toHaveProperty('to');
});

it('still sends the message when the identity lookup fails', async () => {
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith('/api/user/identity')
      ? Promise.reject(new Error('down'))
      : { ok: true, status: 200, text: async () => '{}' }
  );
  const res = await call(BODY, { cookie: 'AUTH-TOKEN=visitor' });
  expect(res._getStatusCode()).toBe(200);
  expect(sentBody()).toMatchObject({ walletAddress: null, accountEmail: null });
});

it("passes on emailservice's reason when it refuses the message", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"message: write a message"}' });
  const res = await call(BODY);
  expect(res._getStatusCode()).toBe(400);
  expect(res._getJSONData().error).toBe('message: write a message');
});

it('refuses a body without an email and a message', async () => {
  const res = await call({ message: 'hi' });
  expect(res._getStatusCode()).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('limits each address to 10 an hour', async () => {
  const headers = { 'x-forwarded-for': '10.9.9.9' };
  for (let i = 0; i < 10; i++) expect((await call(BODY, headers))._getStatusCode()).toBe(200);
  expect((await call(BODY, headers))._getStatusCode()).toBe(429);
});

it('answers 503 when this box has no emailservice key', async () => {
  delete process.env.TO_EMAILSERVICE_API_KEY;
  expect((await call(BODY))._getStatusCode()).toBe(503);
});
