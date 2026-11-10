/**
 * The "Report a problem" routes: public and rate-limited, the video never touching this server,
 * the account looked up from userservice, and nobody told until the bucket confirms the file.
 */
import { createMocks } from 'node-mocks-http';
import create from '@/pages/api/recordings/index';
import partUrl from '@/pages/api/recordings/[id]/part-url';
import complete from '@/pages/api/recordings/[id]/complete';
import * as storeModule from '@/lib/server/recordingStore';
import { MAX_FILE_BYTES, MULTIPART_THRESHOLD_BYTES, PART_BYTES } from '@/lib/problemReport';

jest.mock('@/lib/server/recordingStore', () => ({
  recordingsConfigured: jest.fn(() => true),
  videoKey: (id: string, ext: string) => `recordings/${id}/video.${ext}`,
  recordKey: (id: string) => `recordings/${id}/record.json`,
  signedUploadUrl: jest.fn(async (key: string) => `https://bucket.example/${key}?signed-put`),
  startMultipart: jest.fn(async () => 'upload-1'),
  signedPartUrl: jest.fn(async (key: string, uploadId: string, n: number) => `https://bucket.example/${key}?part=${n}&uploadId=${uploadId}`),
  finishMultipart: jest.fn(async () => undefined),
  storedSize: jest.fn(),
  remove: jest.fn(async () => undefined),
  signedViewUrl: jest.fn(async (key: string) => `https://bucket.example/${key}?signed-get`),
  writeRecord: jest.fn(),
  readRecord: jest.fn(),
}));
const store = storeModule as jest.Mocked<typeof storeModule>;

const records = new Map<string, any>();
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const BODY = {
  contentType: 'video/webm;codecs=vp9',
  size: 1000,
  description: '  Paying by card  ',
  contactEmail: 'ana@example.com',
  source: 'recorder',
  pageUrl: 'https://stabledrop.me/contract-pay?id=1',
  route: '/contract-pay',
  viewport: { width: 1280, height: 720 },
  platform: 'MacIntel',
  appVersion: 'abc1234',
  clientTime: '2026-11-10T12:00:00.000Z',
  timezone: 'Europe/London',
  connectedWallet: WALLET,
  replayId: null,
  console: ['error unsupported asset for stripe onramp'],
};

let ip = 0;
const call = async (handler: any, body: unknown, query: Record<string, string> = {}, headers: Record<string, string> = {}) => {
  ip += 1;
  const { req, res } = createMocks({
    method: 'POST',
    body: body as any,
    query,
    headers: { 'x-forwarded-for': `10.2.0.${ip}`, 'user-agent': 'TestAgent/1', ...headers },
  });
  await handler(req as any, res as any);
  return res as unknown as { _getStatusCode(): number; _getJSONData(): any };
};
const emailCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/email/'));

beforeEach(() => {
  records.clear();
  jest.clearAllMocks();
  store.recordingsConfigured.mockReturnValue(true);
  store.writeRecord.mockImplementation(async (id: string, record: unknown) => void records.set(id, JSON.parse(JSON.stringify(record))));
  store.readRecord.mockImplementation(async (id: string) => (records.has(id) ? JSON.parse(JSON.stringify(records.get(id))) : null));
  store.storedSize.mockResolvedValue(1000);
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith('/api/user/identity')
      ? { ok: true, status: 200, json: async () => ({ userId: 'u1', email: 'ana.account@example.com', walletAddress: WALLET }) }
      : { ok: true, status: 200, text: async () => '{"success":true}' }
  );
  process.env.EMAIL_SERVICE_URL = 'http://emailservice:8979';
  process.env.TO_EMAILSERVICE_API_KEY = 'to-email-key';
  process.env.USER_SERVICE_URL = 'http://userservice:8977';
});

describe('POST /api/recordings', () => {
  it('answers an id and a signed PUT for exactly the declared type and size, and keeps the context', async () => {
    const res = await call(create, BODY, {}, { cookie: 'AUTH-TOKEN=visitor' });
    expect(res._getStatusCode()).toBe(201);
    const { id, upload } = res._getJSONData();
    expect(upload).toEqual({ kind: 'single', url: `https://bucket.example/recordings/${id}/video.webm?signed-put`, headers: { 'Content-Type': 'video/webm' } });
    expect(store.signedUploadUrl).toHaveBeenCalledWith(`recordings/${id}/video.webm`, 'video/webm', 1000);

    const record = records.get(id);
    expect(record).toMatchObject({
      status: 'uploading',
      description: 'Paying by card',
      contactEmail: 'ana@example.com',
      source: 'recorder',
      account: { userId: 'u1', walletAddress: WALLET, accountEmail: 'ana.account@example.com' },
      reported: { route: '/contract-pay', viewport: { width: 1280, height: 720 }, timezone: 'Europe/London', connectedWallet: WALLET, console: BODY.console },
      request: { userAgent: 'TestAgent/1' },
    });
  });

  it('takes the account from userservice, never from the body', async () => {
    const res = await call(create, { ...BODY, account: { userId: 'ceo' }, userId: 'ceo', connectedWallet: 'not-a-wallet' });
    const record = records.get(res._getJSONData().id);
    expect(record.account).toEqual({ userId: null, walletAddress: null, accountEmail: null });
    expect(record.reported.connectedWallet).toBeNull();
  });

  it('keeps only the last 50 console lines, each cut to size', async () => {
    const res = await call(create, { ...BODY, console: Array.from({ length: 80 }, (_, i) => `line ${i} ${'x'.repeat(3000)}`) });
    const kept = records.get(res._getJSONData().id).reported.console;
    expect(kept).toHaveLength(50);
    expect(kept[0].startsWith('line 30 ')).toBe(true);
    expect(kept[0].length).toBeLessThanOrEqual(1000);
  });

  it('starts a multipart upload for a large file and hands out no URL yet', async () => {
    const size = MULTIPART_THRESHOLD_BYTES + 1;
    const res = await call(create, { ...BODY, size });
    const { id, upload } = res._getJSONData();
    expect(upload).toEqual({ kind: 'multipart', partBytes: PART_BYTES, partCount: 3 });
    expect(records.get(id).upload).toEqual({ kind: 'multipart', uploadId: 'upload-1' });
    expect(store.signedUploadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['a file that is not video', { contentType: 'application/zip' }],
    ['a file over 500 MB', { size: MAX_FILE_BYTES + 1 }],
    ['no size', { size: undefined }],
    ['no contact email', { contactEmail: 'nope' }],
    ['an unknown source', { source: 'elsewhere' }],
  ])('refuses %s', async (_name, change) => {
    const res = await call(create, { ...BODY, ...change });
    expect(res._getStatusCode()).toBe(400);
    expect(store.writeRecord).not.toHaveBeenCalled();
  });

  it('answers 503 where no bucket is configured', async () => {
    store.recordingsConfigured.mockReturnValue(false);
    expect((await call(create, BODY))._getStatusCode()).toBe(503);
  });

  it('limits each address to 10 recordings an hour', async () => {
    const headers = { 'x-forwarded-for': '10.9.9.9' };
    for (let i = 0; i < 10; i += 1) expect((await call(create, BODY, {}, headers))._getStatusCode()).toBe(201);
    expect((await call(create, BODY, {}, headers))._getStatusCode()).toBe(429);
  });

  it('answers 405 to anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await create(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});

describe('POST /api/recordings/{id}/part-url', () => {
  const started = async () => (await call(create, { ...BODY, size: MULTIPART_THRESHOLD_BYTES + 1 }))._getJSONData().id as string;

  it('signs one part of a recording that is waiting for parts', async () => {
    const id = await started();
    const res = await call(partUrl, { partNumber: 2 }, { id });
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().url).toContain('part=2&uploadId=upload-1');
  });

  it('refuses a part beyond the declared size, an unknown id and a single-part recording', async () => {
    const id = await started();
    expect((await call(partUrl, { partNumber: 4 }, { id }))._getStatusCode()).toBe(400);
    expect((await call(partUrl, { partNumber: 1 }, { id: '../../etc' }))._getStatusCode()).toBe(404);
    expect((await call(partUrl, { partNumber: 1 }, { id: '11111111-1111-4111-8111-111111111111' }))._getStatusCode()).toBe(404);
    const single = (await call(create, BODY))._getJSONData().id;
    expect((await call(partUrl, { partNumber: 1 }, { id: single }))._getStatusCode()).toBe(409);
  });
});

describe('POST /api/recordings/{id}/complete', () => {
  const created = async (change: Record<string, unknown> = {}) =>
    (await call(create, { ...BODY, ...change }, {}, { cookie: 'AUTH-TOKEN=visitor' }))._getJSONData().id as string;

  it('tells us once the bucket has the file: description, account, page and 7-day links', async () => {
    const id = await created();
    const res = await call(complete, {}, { id });
    expect(res._getStatusCode()).toBe(200);
    expect(records.get(id).status).toBe('notified');

    const [url, init] = emailCalls()[0];
    expect(url).toBe('http://emailservice:8979/api/email/in-app-feedback');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-KEY': 'to-email-key' });
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      contactEmail: 'ana@example.com',
      pageUrl: BODY.pageUrl,
      walletAddress: WALLET,
      accountEmail: 'ana.account@example.com',
      userAgent: 'TestAgent/1',
    });
    expect(sent.message).toContain('Paying by card');
    expect(sent.message).toContain(`https://bucket.example/recordings/${id}/video.webm?signed-get`);
    expect(sent.message).toContain(`https://bucket.example/recordings/${id}/record.json?signed-get`);
    expect(sent.message).toContain('User id: u1');
    expect(sent.message.length).toBeLessThanOrEqual(5000);
  });

  it('tells nobody while the file is not in the bucket', async () => {
    const id = await created();
    store.storedSize.mockResolvedValue(null);
    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(409);
    expect(emailCalls()).toHaveLength(0);
    expect(records.get(id).status).toBe('uploading');
  });

  it('assembles a multipart upload from the parts the bucket lists', async () => {
    const size = MULTIPART_THRESHOLD_BYTES + 1;
    const id = await created({ size });
    store.storedSize.mockResolvedValue(size);
    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(200);
    expect(store.finishMultipart).toHaveBeenCalledWith(`recordings/${id}/video.webm`, 'upload-1');
  });

  it('removes an upload that is not the size that was declared', async () => {
    const size = MULTIPART_THRESHOLD_BYTES + 1;
    const id = await created({ size });
    store.storedSize.mockResolvedValue(size * 20);
    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(400);
    expect(store.remove).toHaveBeenCalledWith(`recordings/${id}/video.webm`);
    expect(emailCalls()).toHaveLength(0);
  });

  it('answers 502 when we could not be told, and tells us on the next try, once', async () => {
    const id = await created();
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, text: async () => '' }));
    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(502);
    expect(records.get(id).status).toBe('uploaded');

    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(200);
    expect((await call(complete, {}, { id }))._getStatusCode()).toBe(200);
    expect(emailCalls()).toHaveLength(2);
  });

  it('answers 404 for an id that was never issued', async () => {
    expect((await call(complete, {}, { id: '11111111-1111-4111-8111-111111111111' }))._getStatusCode()).toBe(404);
    expect((await call(complete, {}, { id: 'nope' }))._getStatusCode()).toBe(404);
  });
});
