/**
 * A rate-limited read must say so. ethers re-labels the node's refusal by the kind of request
 * it was, so shown raw it reads as a broken contract ("missing revert data").
 */
import { ethers } from 'ethers';
import { isRateLimited, RpcRateLimitedError, RATE_LIMIT_MESSAGE, hostOf } from '@/lib/rpc/rateLimit';
import { readProviderFor } from '@/lib/rpc/RpcClient';
import { explainTransactionFailure } from '@/lib/explainTransactionFailure';

describe('recognising a rate limit', () => {
  it.each([
    ['the node\'s own JSON-RPC error', { code: -32016, message: 'over rate limit' }],
    ['an HTTP 429', { status: 429, message: 'Too Many Requests' }],
    ['ethers giving up after retrying', Object.assign(new Error('exceeded maximum retry limit'), { code: 'SERVER_ERROR' })],
    [
      'a contract read ethers re-labelled as a failed call',
      Object.assign(new Error('missing revert data'), {
        code: 'CALL_EXCEPTION',
        info: { error: { code: -32016, message: 'over rate limit' } },
      }),
    ],
    ['one wrapped as a cause', Object.assign(new Error('read failed'), { cause: { message: 'rate limit exceeded' } })],
    ['one already recognised', new RpcRateLimitedError('eth_call')],
  ])('%s is a rate limit', (_what, e) => {
    expect(isRateLimited(e)).toBe(true);
  });

  it.each([
    ['a real revert', Object.assign(new Error('execution reverted: NotAuthorizedToVote'), { code: 'CALL_EXCEPTION', data: '0x1234' })],
    ['a network failure', new TypeError('Failed to fetch')],
    ['a user rejecting in their wallet', { code: 4001, message: 'User rejected the request.' }],
    ['nothing', null],
    ['an object that refers to itself', (() => { const o: any = { message: 'boom' }; o.cause = o; return o; })()],
  ])('%s is not', (_what, e) => {
    expect(isRateLimited(e)).toBe(false);
  });

  it('names the host of an endpoint and never its path, which can carry a key', () => {
    expect(hostOf('https://rpc.ankr.com/base/0123456789abcdef0123456789abcdef')).toBe('rpc.ankr.com');
    expect(hostOf('nonsense')).toBe('(unknown endpoint)');
  });
});

describe('the read provider', () => {
  const rateLimitedCall = Object.assign(new Error('missing revert data'), {
    code: 'CALL_EXCEPTION',
    info: { error: { code: -32016, message: 'over rate limit' } },
  });
  let warn: jest.SpyInstance;
  let send: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    send = jest.spyOn(ethers.JsonRpcProvider.prototype, 'send');
  });
  afterEach(() => {
    warn.mockRestore();
    send.mockRestore();
  });

  it('turns a rate-limited read into an error whose message is fit to show', async () => {
    send.mockRejectedValue(rateLimitedCall);
    const provider = readProviderFor('https://limited-one.example/secretkeysecretkey', 8453);

    const failure = await provider.send('eth_call', []).catch((e) => e);

    expect(failure).toBeInstanceOf(RpcRateLimitedError);
    expect(failure.name).toBe('RpcRateLimitedError');
    expect(failure.message).toBe(RATE_LIMIT_MESSAGE);
    expect(failure.method).toBe('eth_call');
  });

  it('logs it in plain words, naming the host and the request but not the path', async () => {
    send.mockRejectedValue(rateLimitedCall);
    const provider = readProviderFor('https://limited-two.example/secretkeysecretkey', 8453);

    await provider.send('eth_getBalance', []).catch(() => {});

    const line = warn.mock.calls.map((c) => String(c[0])).find((l) => l.includes('RATE LIMITED'));
    expect(line).toBe('[rpc] RATE LIMITED by limited-two.example on eth_getBalance');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secretkeysecretkey');
  });

  it('logs a burst once, not once per read', async () => {
    send.mockRejectedValue(rateLimitedCall);
    const provider = readProviderFor('https://limited-three.example', 8453);

    for (let i = 0; i < 5; i++) await provider.send('eth_call', []).catch(() => {});

    expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('[rpc] RATE LIMITED'))).toHaveLength(1);
  });

  it('leaves every other failure exactly as it was', async () => {
    const revert = Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION', data: '0x1234' });
    send.mockRejectedValue(revert);
    const provider = readProviderFor('https://fine.example', 8453);

    await expect(provider.send('eth_call', [])).rejects.toBe(revert);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('RATE LIMITED'))).toHaveLength(0);
  });

  it('passes an answer straight through', async () => {
    send.mockResolvedValue('0x10');
    await expect(readProviderFor('https://fine.example', 8453).send('eth_blockNumber', [])).resolves.toBe('0x10');
  });
});

describe('on the dispute screens', () => {
  it('a rate-limited read is explained as one', () => {
    const t = ((key: string) => key) as any;
    expect(explainTransactionFailure(new RpcRateLimitedError('eth_call'), t)).toBe('transaction.rateLimited');
  });
});
