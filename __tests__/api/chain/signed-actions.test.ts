/**
 * A party signs a message and chainservice delivers it. These routes carry the message there as
 * the signed-in user, forwarding only the fields each action takes.
 */

import { createMocks } from 'node-mocks-http';
import support from '@/pages/api/chain/contract/[contractAddress]/signed-calls';
import signed from '@/pages/api/chain/signed/[action]';
import raiseDispute from '@/pages/api/chain/raise-dispute';

jest.mock('@/utils/api-auth', () => ({ requireAuth: jest.fn(() => 'user-token') }));
const { requireAuth } = jest.requireMock('@/utils/api-auth');

const CONTRACT = '0x9a4264B3173FA692bDd159cB226e4ae491e2989c';
const BUYER = '0x54b8AbfCfb942A77d01dc24478526AE3aC950A00';
const OTHER = '0x000000000000000000000000000000000000CA4D';
const SIGNATURE = '0x' + 'ab'.repeat(65);
const message = { nonce: '7', deadline: '4102444800', signature: SIGNATURE };
const base = { contractAddress: CONTRACT, signer: BUYER, ...message };

describe('signed-action routes', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ status: 200, text: async () => JSON.stringify({ success: true, transactionHash: '0xcd' }) });
    global.fetch = fetchMock as any;
    requireAuth.mockReset();
    requireAuth.mockReturnValue('user-token');
    process.env.CHAIN_SERVICE_URL = 'http://chainservice:8978';
    process.env.X_API_KEY = 'a-service-key';
  });
  afterEach(() => { delete process.env.X_API_KEY; });
  afterAll(() => { global.fetch = realFetch; });

  const call = async (handler: any, method: string, query: Record<string, string>, body?: unknown) => {
    const { req, res } = createMocks({ method: method as any, query, body: body as any, headers: { cookie: 'AUTH-TOKEN=x' } });
    await handler(req as any, res as any);
    return res;
  };
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url, init, body: init.body ? JSON.parse(init.body) : undefined };
  };

  describe('GET /api/chain/contract/[contractAddress]/signed-calls', () => {
    it('asks chainservice as the user, with no service key, and passes the answer on', async () => {
      const answer = { supported: true, domain: { name: 'Stabledrop', version: '1', chainId: 8453, verifyingContract: CONTRACT } };
      fetchMock.mockResolvedValue({ status: 200, text: async () => JSON.stringify(answer) });

      const res = await call(support, 'GET', { contractAddress: CONTRACT });

      expect(sent().url).toBe(`http://chainservice:8978/api/chain/contract/${CONTRACT}/signed-calls`);
      expect(sent().init.headers.Authorization).toBe('Bearer user-token');
      expect(sent().init.headers['X-API-Key']).toBeUndefined();
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(answer);
    });

    it.each(['0xabc', '../../contracts#', 'not-an-address', ''])('refuses %s as a contract address', async value => {
      const res = await call(support, 'GET', { contractAddress: value });
      expect(res._getStatusCode()).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('only answers GET, and only to someone signed in', async () => {
      expect((await call(support, 'POST', { contractAddress: CONTRACT }))._getStatusCode()).toBe(405);
      requireAuth.mockImplementation(() => { throw new Error('Authentication required'); });
      expect((await call(support, 'GET', { contractAddress: CONTRACT }))._getStatusCode()).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chain/signed/[action]', () => {
    const ACTIONS: Array<[string, Record<string, unknown>]> = [
      ['submit-resolution-vote', { refundToBuyerPercent: 30 }],
      ['nominate-arbiter', { candidate: OTHER }],
      ['evict-arbiter', {}],
      ['resign-arbiter', {}],
      ['change-recipient', { newRecipient: OTHER }],
      ['approve-recipient-transfer', { operator: OTHER, newRecipient: BUYER }],
      // The offer vault's: contractAddress is the vault, and they take no fields of their own.
      ['accept-offer', {}],
      ['reject-offer', {}]
    ];

    it.each(ACTIONS)('%s goes to its own chainservice endpoint with exactly its fields', async (action, fields) => {
      const res = await call(signed, 'POST', { action }, { ...base, ...fields, smuggled: 'x', call: '0xdeadbeef' });

      expect(res._getStatusCode()).toBe(200);
      expect(sent().url).toBe(`http://chainservice:8978/api/chain/signed/${action}`);
      expect(sent().body).toEqual({ ...base, ...fields });
      expect(sent().init.headers.Authorization).toBe('Bearer user-token');
      expect(sent().init.headers['X-API-Key']).toBeUndefined();
    });

    it('accepts a numeric nonce and deadline and sends them on as text', async () => {
      await call(signed, 'POST', { action: 'evict-arbiter' }, { ...base, nonce: 7, deadline: 4102444800 });
      expect(sent().body).toEqual(base);
    });

    it.each(['raise-dispute', 'claim-funds', 'constructor', '__proto__', '../raise-dispute'])('there is no %s action', async action => {
      const res = await call(signed, 'POST', { action }, base);
      expect(res._getStatusCode()).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['a vote over 100', 'submit-resolution-vote', { refundToBuyerPercent: 101 }],
      ['a vote that is not a whole number', 'submit-resolution-vote', { refundToBuyerPercent: 30.5 }],
      ['a vote sent as text', 'submit-resolution-vote', { refundToBuyerPercent: '30' }],
      ['a vote with no figure', 'submit-resolution-vote', {}],
      ['a candidate that is not an address', 'nominate-arbiter', { candidate: 'the arbiter' }],
      ['a missing recipient', 'approve-recipient-transfer', { operator: OTHER }],
      ['a signer that is not an address', 'evict-arbiter', { signer: 'me' }],
      ['a contract that is not an address', 'evict-arbiter', { contractAddress: '0x12' }],
      ['a nonce that is not a number', 'evict-arbiter', { nonce: 'seven' }],
      ['a negative deadline', 'evict-arbiter', { deadline: '-1' }],
      ['a signature that is not hex', 'evict-arbiter', { signature: 'signed, honest' }],
      ['an empty signature', 'evict-arbiter', { signature: '0x' }]
    ])('refuses %s without calling chainservice', async (_what, action, fields) => {
      const res = await call(signed, 'POST', { action }, { ...base, ...fields });
      expect(res._getStatusCode()).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([[400, 'refused, nothing sent'], [502, 'sent and failed']])('passes a %i from chainservice straight through (%s)', async status => {
      const answer = { success: false, transactionHash: status === 502 ? '0xcd' : null, error: 'That signature has already been used.' };
      fetchMock.mockResolvedValue({ status, text: async () => JSON.stringify(answer) });

      const res = await call(signed, 'POST', { action: 'evict-arbiter' }, base);

      expect(res._getStatusCode()).toBe(status);
      expect(JSON.parse(res._getData())).toEqual(answer);
    });

    it('only answers POST, and only to someone signed in', async () => {
      expect((await call(signed, 'GET', { action: 'evict-arbiter' }))._getStatusCode()).toBe(405);
      requireAuth.mockImplementation(() => { throw new Error('Authentication required'); });
      expect((await call(signed, 'POST', { action: 'evict-arbiter' }, base))._getStatusCode()).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chain/raise-dispute', () => {
    const who = { contractAddress: CONTRACT, userWalletAddress: BUYER };

    it('forwards a signed message, and the record fields when they are given', async () => {
      const body = { ...who, signedCall: message, reason: 'late', refundPercent: 30, databaseId: '6af90863a1c5f839cca35f47' };
      const res = await call(raiseDispute, 'POST', {}, { ...body, smuggled: 'x', signedCall: { ...message, call: '0xdeadbeef' } });

      expect(res._getStatusCode()).toBe(200);
      expect(sent().url).toBe('http://chainservice:8978/api/chain/raise-dispute');
      expect(sent().body).toEqual(body);
      expect(sent().init.headers['X-API-Key']).toBeUndefined();
    });

    it('forwards a signed transaction the older way, with nothing it was not given', async () => {
      await call(raiseDispute, 'POST', {}, { ...who, signedTransaction: '0xf86b' });
      expect(sent().body).toEqual({ ...who, signedTransaction: '0xf86b' });
    });

    it.each([
      ['both a message and a transaction', { signedCall: message, signedTransaction: '0xf86b' }],
      ['neither', {}],
      ['a blank transaction', { signedTransaction: '  ' }],
      ['a transaction that is not hex', { signedTransaction: 'please' }],
      ['a message with no signature', { signedCall: { nonce: '7', deadline: '4102444800' } }],
      ['a database id that could change a path', { signedCall: message, databaseId: '../x' }],
      ['a reason over 160 characters', { signedCall: message, reason: 'x'.repeat(161) }],
      ['a refund over 100', { signedCall: message, refundPercent: 150 }],
      ['a buyer that is not an address', { signedCall: message, userWalletAddress: 'me' }]
    ])('refuses %s without calling chainservice', async (_what, fields) => {
      const res = await call(raiseDispute, 'POST', {}, { ...who, ...fields });
      expect(res._getStatusCode()).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('only answers POST', async () => {
      expect((await call(raiseDispute, 'GET', {}))._getStatusCode()).toBe(405);
    });
  });
});
