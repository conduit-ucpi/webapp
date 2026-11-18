/**
 * Gas for the two steps of a stablecoin conversion. Each route carries the step the wallet wants
 * to take to chainservice as the signed-in user; chainservice builds the call and decides.
 */

import { createMocks } from 'node-mocks-http';
import approvalHandler from '@/pages/api/chain/fund-swap-approval';
import swapHandler from '@/pages/api/chain/fund-swap';

jest.mock('@/utils/api-auth', () => ({ requireAuth: jest.fn(() => 'user-token') }));
const { requireAuth } = jest.requireMock('@/utils/api-auth');

const WALLET = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const approval = { walletAddress: WALLET, tokenAddress: USDC, amount: '5025000' };
const swap = { walletAddress: WALLET, tokenIn: USDC, tokenOut: USDT, amountOut: '5000000', amountInMaximum: '5025000' };

describe('gas for a conversion', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let logged: string[];

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ success: true, funded: true, reason: 'FUNDED', message: 'Gas for this conversion has been sent.', amountWei: '5040000000000' })
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

  const call = async (handler: any, method: string, body?: unknown) => {
    const { req, res } = createMocks({ method: method as any, body: body as any, headers: { cookie: 'AUTH-TOKEN=x' } });
    await handler(req as any, res as any);
    return res;
  };
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url, init, body: JSON.parse(init.body) };
  };

  describe.each([
    ['POST /api/chain/fund-swap-approval', approvalHandler, approval, 'http://chainservice:8978/api/chain/fund-swap-approval'],
    ['POST /api/chain/fund-swap', swapHandler, swap, 'http://chainservice:8978/api/chain/fund-swap']
  ])('%s', (_name, handler, good, url) => {
    it('carries the step to chainservice as the user, with no service key, and passes the answer on', async () => {
      const res = await call(handler, 'POST', good);

      expect(sent().url).toBe(url);
      expect(sent().body).toEqual(good);
      expect(sent().init.headers.Authorization).toBe('Bearer user-token');
      expect(sent().init.headers['X-API-Key']).toBeUndefined();
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toMatchObject({ funded: true, reason: 'FUNDED' });
    });

    it('forwards only the step\'s own fields: no spender, no recipient, no amount of gas to be given', async () => {
      await call(handler, 'POST', {
        ...good, neededWei: 900000000000, totalAmountNeededWei: '200000000000000',
        spender: WALLET, router: WALLET, recipient: USDT, fee: 3000, smuggled: 'x'
      });
      expect(sent().body).toEqual({ ...good, neededWei: '900000000000' });
    });

    it.each([
      [400, { success: false, funded: false, reason: 'NATIVE_SENT_OUT', message: 'This wallet sent native tokens out in the last 24 hours' }],
      [400, { success: false, funded: false, reason: 'SWAP_WOULD_FAIL', message: 'That conversion would fail on chain' }],
      [503, { success: false, funded: false, reason: 'HISTORY_UNAVAILABLE', message: 'Try again.' }],
      [403, { success: false, funded: false, reason: 'NOT_YOUR_WALLET', message: 'Gas can only be requested for the wallet you are signed in with.' }],
      [200, { success: true, funded: false, reason: 'ALREADY_APPROVED', message: 'The router may already take that much; no approval is needed.', amountWei: '0' }]
    ])("passes chainservice's %i straight through", async (status, answer) => {
      fetchMock.mockResolvedValue({ status, text: async () => JSON.stringify(answer) });

      const res = await call(handler, 'POST', good);

      expect(res._getStatusCode()).toBe(status);
      expect(JSON.parse(res._getData())).toEqual(answer);
    });

    it('only answers POST, and only to someone signed in', async () => {
      expect((await call(handler, 'GET'))._getStatusCode()).toBe(405);
      requireAuth.mockImplementation(() => { throw new Error('Authentication required'); });
      expect((await call(handler, 'POST', good))._getStatusCode()).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a needed figure that is not a number', async () => {
      expect((await call(handler, 'POST', { ...good, neededWei: 'lots' }))._getStatusCode()).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['a wallet that is not an address', { walletAddress: 'mine' }],
    ['a token that is not an address', { tokenAddress: '../../contracts#' }],
    ['no amount', { amount: undefined }],
    ['an amount of zero', { amount: '0' }],
    ['an amount that is not a whole number', { amount: '12.5' }]
  ])('the approval refuses %s without calling chainservice', async (_what, fields) => {
    expect((await call(approvalHandler, 'POST', { ...approval, ...fields }))._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a token to convert from that is not an address', { tokenIn: 'USDC' }],
    ['a token to convert to that is not an address', { tokenOut: undefined }],
    ['nothing to receive', { amountOut: '0' }],
    ['a negative ceiling', { amountInMaximum: '-5' }],
    ['no ceiling', { amountInMaximum: undefined }]
  ])('the conversion refuses %s without calling chainservice', async (_what, fields) => {
    expect((await call(swapHandler, 'POST', { ...swap, ...fields }))._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs both steps under FUND SWAP, with addresses masked', async () => {
    await call(approvalHandler, 'POST', approval);
    await call(swapHandler, 'POST', swap);

    const lines = logged.filter(line => line.startsWith('FUND SWAP [webapp]'));
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('approval: wallet 0x78A6***afBD wants to let the router take up to 5025000 of token 0x8335***2913');
    expect(lines[1]).toContain('chainservice answered 200');
    expect(lines[2]).toContain('conversion: wallet 0x78A6***afBD wants exactly 5000000 of token 0xfde4***9bb2 for at most 5025000 of token 0x8335***2913');
    expect(lines.join('\n')).not.toContain(WALLET);
  });
});
