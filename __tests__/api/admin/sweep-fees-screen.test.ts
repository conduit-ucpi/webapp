import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/sweep-fees-screen';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const reply = (status: number, body: unknown) =>
  ({ status, ok: status < 400, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response);

const escrow = '0xE0b241AbfCfb942A77d01dc24478526AE3aC95c8';
const buyer = '0x39C3236A2F7FCE4Cc215a24fFb32aC48646b2288';
const seller = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
const arbiter = '0xA3B1000000000000000000000000000000000001';
const payer = '0x7f367cc41522ce07553e823bf3be79a889debe1b';
const target = '0x1111111111111111111111111111111111111111';

const chainParties = (over: Record<string, unknown> = {}) => ({
  contractAddress: escrow, tokenAddress: '0xusdc', createdAt: 1_700_100_000, arbiterReadable: true,
  parties: [{ role: 'buyer', address: buyer }, { role: 'seller', address: seller }, { role: 'arbiter', address: arbiter }],
  funders: [payer, buyer.toLowerCase()], fundersComplete: true, fundersFromBlock: '1', fundersToBlock: '9',
  fundedSince: 1_700_000_000, fundedSinceSource: 'caller', ...over
});

const record = (wallets: string[] = []) => ({
  recordFound: true, createdAt: 1_700_000_000,
  recordEmails: [{ role: 'seller', email: 'Seller@Shop.example' }],
  walletEmails: wallets.map((w) =>
    w === buyer ? { wallet: w, lookup: 'FOUND', email: 'buyer@mail.example', detail: null } : { wallet: w, lookup: 'NONE', email: null, detail: null })
});

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Answer each service by URL; sanctionservice scores [risky] values 100 and the rest 0. */
function services({ contract, chain, risky = [] as string[] }: { contract?: Route; chain?: Route; risky?: string[] }) {
  mockFetch.mockImplementation(async (input, init) => {
    const url = String(input);
    const req = init as RequestInit;
    if (url.startsWith('http://contractservice')) {
      return contract ? contract(url, req) : reply(200, record(JSON.parse(req.body as string).wallets));
    }
    if (url.startsWith('http://chainservice')) return chain ? chain(url, req) : reply(200, chainParties());
    if (url.startsWith('http://sanctionservice')) {
      const { subjects } = JSON.parse(req.body as string);
      return reply(200, { results: subjects.map((s: { value: string }) => ({ ...s, risk: risky.includes(s.value.toLowerCase()) ? 100 : 0 })) });
    }
    throw new Error(`unexpected ${url}`);
  });
}

async function run(body: Record<string, unknown> = { contractAddress: escrow, target1: target, target2: '' }, cookie = 'AUTH-TOKEN=tok') {
  const { req, res } = createMocks({ method: 'POST', headers: cookie ? { cookie } : {}, body });
  await handler(req as any, res as any);
  return { status: res._getStatusCode(), body: JSON.parse(res._getData()) };
}

const sanctionCalls = () => mockFetch.mock.calls.filter(([u]) => String(u).startsWith('http://sanctionservice'));

describe('/api/admin/sweep-fees-screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAIN_SERVICE_URL = 'http://chainservice:8978';
    process.env.CONTRACT_SERVICE_URL = 'http://contractservice:8080';
    process.env.SANCTION_SERVICE_URL = 'http://sanctionservice:8986';
  });

  it('is POST only and needs a session before anything is called', async () => {
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect((await run(undefined, '')).status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a malformed address without calling anything', async () => {
    expect((await run({ contractAddress: '0x123' })).status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('screens every wallet, email and domain once, and sends sanctionservice no session', async () => {
    services({});
    const { status, body } = await run();

    expect(status).toBe(200);
    expect(body.clean).toBe(true);
    const byValue = Object.fromEntries(body.subjects.map((s: any) => [s.value.toLowerCase(), s]));
    expect(byValue[buyer.toLowerCase()].roles).toBe('buyer, funder');
    expect(byValue[payer].roles).toBe('funder');
    expect(byValue[target].roles).toBe('sweep target');
    expect(byValue['seller@shop.example'].type).toBe('EMAIL');
    expect(byValue['buyer@mail.example'].roles).toContain('email of buyer, funder');
    expect(body.subjects.filter((s: any) => s.type === 'DOMAIN').map((s: any) => s.value).sort()).toEqual(['mail.example', 'shop.example']);
    expect(body.subjects).toHaveLength(5 + 2 + 2);

    // The record's quote time bounds the chain's funder scan.
    const chainUrl = mockFetch.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith('http://chainservice'));
    expect(chainUrl).toBe(`http://chainservice:8978/api/admin/escrows/${escrow}/parties?fundedSince=1700000000`);
    // Admin credentials go to chainservice and contractservice; none to sanctionservice.
    mockFetch.mock.calls.filter(([u]) => !String(u).startsWith('http://sanctionservice'))
      .forEach(([, init]) => expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' }));
    const [sanctionUrl, sanctionInit] = sanctionCalls()[0];
    expect(sanctionUrl).toBe('http://sanctionservice:8986/api/sanctions/screen');
    expect((sanctionInit as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse((sanctionInit as RequestInit).body as string).reference).toBe(escrow);
  });

  it('reports a hit, first, and is not clean', async () => {
    services({ risky: ['shop.example'] });
    const { body } = await run();
    expect(body.clean).toBe(false);
    expect(body.hits).toBe(1);
    expect(body.subjects[0]).toMatchObject({ type: 'DOMAIN', value: 'shop.example', risk: 100 });
  });

  it('never calls an incomplete check clean', async () => {
    services({
      chain: () => reply(200, chainParties({ fundersComplete: false })),
      contract: (_u, init) => {
        const wallets: string[] = JSON.parse(init.body as string).wallets;
        return reply(200, { ...record(), walletEmails: wallets.map((w) => ({ wallet: w, lookup: 'FAILED', email: null, detail: 'timeout' })) });
      }
    });
    const { body } = await run();
    expect(body.hits).toBe(0);
    expect(body.clean).toBe(false);
    expect(body.complete).toBe(false);
    expect(body.warnings.some((w: string) => w.includes('transfer scan'))).toBe(true);
    expect(body.warnings.some((w: string) => w.includes('timeout'))).toBe(true);
  });

  it('screens nothing when either service refuses the session', async () => {
    services({ contract: () => reply(403, {}) });
    expect((await run()).status).toBe(403);
    expect(sanctionCalls()).toHaveLength(0);

    jest.clearAllMocks();
    services({ contract: () => { throw new Error('down'); }, chain: () => reply(403, { error: 'Only an admin user may read this' }) });
    expect((await run()).status).toBe(403);
    expect(sanctionCalls()).toHaveLength(0);
  });

  it('is unavailable, not clean, when sanctionservice does not score everything', async () => {
    services({});
    const base = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (input, init) =>
      String(input).startsWith('http://sanctionservice') ? reply(500, {}) : base(input, init));
    const { status, body } = await run();
    expect(status).toBe(503);
    expect(body.clean).toBe(false);
  });
});
