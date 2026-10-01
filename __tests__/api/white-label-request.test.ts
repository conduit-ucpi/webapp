/**
 * The white-label request route: public, rate-limited, and forwarding only the fields emailservice
 * takes, with this app's emailservice key and nothing of the visitor's.
 */
import { createMocks } from 'node-mocks-http';
import handler, { allow } from '@/pages/api/white-label-request';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const BODY = {
  contactName: 'Ana Ruiz',
  contactEmail: 'ana@cobro.example',
  productionDomains: ['cobro.example'],
  testDomains: [],
  config: '{"id":"cobro","name":"COBRO"}',
  notes: 'Hello',
  attachments: [{ filename: 'logo.png', contentType: 'image/png', contentBase64: 'iVBORw==' }],
};

let ip = 0;
const call = async (body: unknown, headers: Record<string, string> = {}) => {
  ip += 1;
  const { req, res } = createMocks({
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `10.0.0.${ip}`, cookie: 'AUTH-TOKEN=visitor', ...headers },
  });
  await handler(req as any, res as any);
  return res;
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{"success":true}' });
  process.env.EMAIL_SERVICE_URL = 'http://emailservice:8979';
  process.env.TO_EMAILSERVICE_API_KEY = 'to-email-key';
});

it("sends it to emailservice with this app's emailservice key and nothing of the visitor's", async () => {
  const res = await call(BODY);

  expect(res._getStatusCode()).toBe(200);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://emailservice:8979/api/email/white-label-request');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-KEY': 'to-email-key' });
  expect(JSON.parse(init.body)).toEqual(BODY);
});

it('forwards only the fields the endpoint takes, so no recipient can be slipped in', async () => {
  await call({ ...BODY, to: 'victim@elsewhere.example', bcc: ['x@y.example'] });
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(sent).not.toHaveProperty('to');
  expect(sent).not.toHaveProperty('bcc');
});

it("passes on emailservice's reason when it refuses the request", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"Validation Failed","message":"config: \\"name\\" is required"}' });
  const res = await call(BODY);
  expect(res._getStatusCode()).toBe(400);
  expect(JSON.parse(res._getData()).error).toBe('config: "name" is required');
});

it('says so when it cannot reach emailservice, or is not configured to', async () => {
  fetchMock.mockRejectedValue(new Error('down'));
  expect((await call(BODY))._getStatusCode()).toBe(502);

  delete process.env.TO_EMAILSERVICE_API_KEY;
  expect((await call(BODY))._getStatusCode()).toBe(503);
});

it('needs the contact email and the config before calling anyone', async () => {
  const res = await call({ ...BODY, contactEmail: undefined });
  expect(res._getStatusCode()).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('allows five requests an hour from one address', () => {
  const now = 1_000_000;
  for (let i = 0; i < 5; i += 1) expect(allow('203.0.113.9', now + i)).toBe(true);
  expect(allow('203.0.113.9', now + 10)).toBe(false);
  expect(allow('203.0.113.9', now + 60 * 60 * 1000 + 10)).toBe(true);
  expect(allow('198.51.100.1', now)).toBe(true);
});
