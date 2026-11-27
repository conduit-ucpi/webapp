/**
 * Funding steps only the browser sees, as one log line naming the signed-in user from the session.
 * What matters is who it says the line is from, and what it refuses to log.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/funding-event';
import { fetchIdentity } from '@/lib/server/coinbaseCdp';
import { extractAuthToken } from '@/utils/api-auth';

jest.mock('@/lib/server/coinbaseCdp', () => ({ fetchIdentity: jest.fn() }));
jest.mock('@/utils/api-auth', () => ({ extractAuthToken: jest.fn() }));

const WALLET = '0x6e186283dc6d5e45b88f50476f66aba5a947c9f4';
let address = 0;

const post = async (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const { req, res } = createMocks({
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `203.0.113.${(address += 1)}`, ...headers },
  });
  await handler(req as any, res as any);
  return res;
};

describe('POST /api/funding-event', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    (extractAuthToken as jest.Mock).mockReturnValue(null);
  });
  afterEach(() => log.mockRestore());

  it('logs the step, with the wallet masked as the Kotlin services mask it', async () => {
    const res = await post({ event: 'privy-failed', contract: 'req-1', wallet: WALLET, amount: '15.00', locale: 'es-US', country: 'VE', detail: 'No quotes' });
    expect(res._getStatusCode()).toBe(204);
    expect(log).toHaveBeenCalledWith(
      'FUNDING EVENT privy-failed: contract req-1 user signed-out wallet 0x6e18***c9f4 amount 15.00 locale es-US country VE region unknown provider "unknown" route unknown detail "No quotes"'
    );
  });

  it("logs Cloudflare's country and region from the headers, over whatever the body claims", async () => {
    await post(
      { event: 'privy-started', contract: 'req-2', wallet: WALLET, amount: '5.00', locale: 'en-US', country: 'VE' },
      { 'cf-ipcountry': 'US', 'cf-region-code': 'TX' }
    );
    expect(log).toHaveBeenCalledWith(
      'FUNDING EVENT privy-started: contract req-2 user signed-out wallet 0x6e18***c9f4 amount 5.00 locale en-US country US region TX provider "unknown" route unknown detail ""'
    );
  });

  it("falls back to the body's country when Cloudflare has no country data", async () => {
    await post({ event: 'privy-started', country: 'VE' }, { 'cf-ipcountry': 'XX', 'cf-region-code': 'bad region' });
    expect(String(log.mock.calls[0][0])).toContain('country VE region unknown');
  });

  it('refuses an event it does not know, and logs nothing', async () => {
    expect((await post({ event: 'FUNDING EVENT fake' }))._getStatusCode()).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs placeholders for fields of the wrong shape', async () => {
    await post({ event: 'transfer-opened', contract: 'x\ny', wallet: 'nope', amount: '1; rm', locale: 'es US', country: 'x\ny' });
    expect(log).toHaveBeenCalledWith('FUNDING EVENT transfer-opened: contract none user signed-out wallet unknown amount unknown locale unknown country unknown region unknown provider "unknown" route unknown detail ""');
  });

  it('keeps a provider message to one short line, without emails', async () => {
    await post({ event: 'privy-failed', detail: `bad\nFUNDING EVENT fake for me@example.com ${'x'.repeat(400)}` });
    const line = String(log.mock.calls[0][0]);
    expect(line.split('\n')).toHaveLength(1);
    expect(line).not.toContain('me@example.com');
    expect(line.length).toBeLessThan(380);
  });

  it('logs which option it was: the provider by its listed name and the route', async () => {
    await post({ event: 'card-service-opened', provider: 'Crypto.com', route: 'wallet' });
    expect(String(log.mock.calls[0][0])).toContain('provider "Crypto.com" route wallet detail');
  });

  it('logs placeholders for a provider or route of the wrong shape', async () => {
    await post({ event: 'exchange-opened', provider: 'x"\nFUNDING EVENT fake', route: 'bank' });
    expect(String(log.mock.calls[0][0])).toContain('provider "unknown" route unknown detail');
  });

  it.each(['choice-opened', 'coinbase-opened', 'coinbase-closed', 'card-service-opened', 'exchange-opened', 'balance-checked', 'paid-pressed', 'wallet-funded', 'balance-polled', 'address-polled', 'trouble-shown', 'trouble-reason', 'trouble-action'])(
    'accepts %s',
    async (event) => {
      expect((await await post({ event }))._getStatusCode()).toBe(204);
    }
  );

  it('names the signed-in user from the session, with the wallet on their account masked', async () => {
    (extractAuthToken as jest.Mock).mockReturnValue('token');
    (fetchIdentity as jest.Mock).mockResolvedValue({ userId: '6b07b09c585c425535b6e48d', walletAddress: '0x15BAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa863E' });
    await post({ event: 'privy-started', wallet: WALLET });
    expect(String(log.mock.calls[0][0])).toContain('contract none user 6b07b09c585c425535b6e48d (0x15BA***863E) wallet 0x6e18***c9f4 ');
  });

  it('treats a session the user service does not know as signed out', async () => {
    (extractAuthToken as jest.Mock).mockReturnValue('expired');
    (fetchIdentity as jest.Mock).mockResolvedValue(null);
    await post({ event: 'privy-started' });
    expect(String(log.mock.calls[0][0])).toContain(' user signed-out ');
  });

  it('lets a signed-in user log 600 lines an hour, from any address', async () => {
    (extractAuthToken as jest.Mock).mockReturnValue('token');
    (fetchIdentity as jest.Mock).mockResolvedValue({ userId: 'user-600', walletAddress: WALLET });
    for (let i = 0; i < 601; i++) await post({ event: 'balance-polled' });
    expect(log).toHaveBeenCalledTimes(600);
  });

  it('lets one address with no session log 30 lines an hour', async () => {
    for (let i = 0; i < 31; i++) await post({ event: 'exchange-opened' }, { 'x-forwarded-for': '198.51.100.7' });
    expect(log).toHaveBeenCalledTimes(30);
  });

  it('refuses anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
