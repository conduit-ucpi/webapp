/**
 * Gas for one token transfer. The route carries the transfer the wallet wants to make to
 * chainservice as the signed-in user; chainservice decides whether to pay for it.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/chain/fund-transfer';

jest.mock('@/utils/api-auth', () => ({ requireAuth: jest.fn(() => 'user-token') }));
const { requireAuth } = jest.requireMock('@/utils/api-auth');

const WALLET = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TO = '0x9a4264B3173FA692bDd159cB226e4ae491e2989c';
const transfer = { walletAddress: WALLET, tokenAddress: TOKEN, toAddress: TO, amount: '12091900' };

describe('POST /api/chain/fund-transfer', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let logged: string[];

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ success: true, funded: true, reason: 'FUNDED', message: 'Gas for this transfer has been sent.', amountWei: '2340000000000' })
    });
    global.fetch = fetchMock as any;
    requireAuth.mockReset();
    requireAuth.mockReturnValue('user-token');
    process.env.CHAIN_SERVICE_URL = 'http://chainservice:8978';
    process.env.X_API_KEY = 'a-service-key';
    logged = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logged.push(args.join(' ')); });
  });
  afterEach(() => {
    delete process.env.X_API_KEY;
    jest.restoreAllMocks();
  });
  afterAll(() => { global.fetch = realFetch; });

  const call = async (method: string, body?: unknown) => {
    const { req, res } = createMocks({ method: method as any, body: body as any, headers: { cookie: 'AUTH-TOKEN=x' } });
    await handler(req as any, res as any);
    return res;
  };
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url, init, body: JSON.parse(init.body) };
  };

  it('carries the transfer to chainservice as the user, with no service key, and passes the answer on', async () => {
    const res = await call('POST', transfer);

    expect(sent().url).toBe('http://chainservice:8978/api/chain/fund-transfer');
    expect(sent().body).toEqual(transfer);
    expect(sent().init.headers.Authorization).toBe('Bearer user-token');
    expect(sent().init.headers['X-API-Key']).toBeUndefined();
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({ funded: true, reason: 'FUNDED', amountWei: '2340000000000' });
  });

  it('forwards only the fields a transfer has, and never an amount of gas to be given', async () => {
    await call('POST', { ...transfer, neededWei: 900000000000, totalAmountNeededWei: '200000000000000', smuggled: 'x' });
    expect(sent().body).toEqual({ ...transfer, neededWei: '900000000000' });
  });

  it.each([
    [400, { success: false, funded: false, reason: 'NATIVE_SENT_OUT', message: 'This wallet sent native tokens out in the last 24 hours' }],
    [400, { success: false, funded: false, reason: 'NO_TOKENS', message: 'The wallet holds 0 of that token' }],
    [503, { success: false, funded: false, reason: 'HISTORY_UNAVAILABLE', message: 'Try again.' }],
    [403, { success: false, funded: false, reason: 'NOT_YOUR_WALLET', message: 'Gas can only be requested for the wallet you are signed in with.' }],
    [200, { success: true, funded: false, reason: 'ALREADY_HAS_GAS', message: 'The wallet already holds enough for this transfer.', amountWei: '0' }]
  ])("passes chainservice's %i straight through", async (status, answer) => {
    fetchMock.mockResolvedValue({ status, text: async () => JSON.stringify(answer) });

    const res = await call('POST', transfer);

    expect(res._getStatusCode()).toBe(status);
    expect(JSON.parse(res._getData())).toEqual(answer);
  });

  it.each([
    ['a wallet that is not an address', { walletAddress: 'mine' }],
    ['a token that is not an address', { tokenAddress: 'USDC' }],
    ['a destination that is not an address', { toAddress: '../../contracts#' }],
    ['no amount', { amount: undefined }],
    ['an amount of zero', { amount: '0' }],
    ['an amount that is not a whole number', { amount: '12.5' }],
    ['a negative amount', { amount: '-5' }],
    ['a needed figure that is not a number', { neededWei: 'lots' }]
  ])('refuses %s without calling chainservice', async (_what, fields) => {
    const res = await call('POST', { ...transfer, ...fields });
    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only answers POST, and only to someone signed in', async () => {
    expect((await call('GET'))._getStatusCode()).toBe(405);
    requireAuth.mockImplementation(() => { throw new Error('Authentication required'); });
    expect((await call('POST', transfer))._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs the request and the answer under FUND TRANSFER, with addresses masked', async () => {
    await call('POST', transfer);

    const lines = logged.filter(line => line.startsWith('FUND TRANSFER [webapp]'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('wallet 0x78A6***afBD wants to send 12091900 of token 0x8335***2913 to 0x9a42***989c');
    expect(lines[1]).toContain('chainservice answered 200');
    expect(lines[1]).toContain('funded=true');
    expect(lines[1]).toContain('reason="FUNDED"');
    expect(lines.join('\n')).not.toContain(WALLET);
  });
});
