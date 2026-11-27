/**
 * Waiting on a sent transaction is bounded and unhurried: each look is a request against a
 * rate-limited public endpoint. One minute at most, a look every four seconds, and when the
 * looks were being refused for asking too often, the timeout says that.
 */
import { Web3Service } from '@/lib/web3';
import { RpcRateLimitedError } from '@/lib/rpc/rateLimit';

const HASH = '0xabc';

function serviceReading(getTransactionReceipt: jest.Mock) {
  const service = Object.create((Web3Service as any).prototype);
  service.readProvider = { getTransactionReceipt };
  return service;
}

/** Run a wait to its end under fake timers, returning what it resolved or threw. */
async function settle(wait: Promise<any>) {
  const outcome = wait.then(
    (value) => ({ value }),
    (error) => ({ error })
  );
  for (let i = 0; i < 100; i++) await jest.advanceTimersByTimeAsync(4000);
  return outcome as Promise<{ value?: any; error?: Error }>;
}

describe('waiting for a sent transaction to confirm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('gives up after one minute by default', async () => {
    const read = jest.fn().mockResolvedValue(null);
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH));
    expect(error?.message).toContain('timed out after 60 seconds');
  });

  it('gives up after one minute even when asked to wait longer', async () => {
    const read = jest.fn().mockResolvedValue(null);
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH, 10 * 60_000));
    expect(error?.message).toContain('timed out after 60 seconds');
  });

  it('looks every four seconds, so a minute is fifteen looks, not thirty', async () => {
    const read = jest.fn().mockResolvedValue(null);
    await settle(serviceReading(read).waitForTransaction(HASH));
    expect(read).toHaveBeenCalledTimes(15);
  });

  it('still honours a shorter wait', async () => {
    const read = jest.fn().mockResolvedValue(null);
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH, 8000));
    expect(error?.message).toContain('timed out after 8 seconds');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('says the network was limiting us when that is why it could not tell', async () => {
    const read = jest.fn().mockRejectedValue(new RpcRateLimitedError('eth_getTransactionReceipt'));
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH, 60_000, 'contract-1'));
    expect(error?.message).toContain('limiting how often this page can read');
    expect(error?.message).toContain('It may still have gone through');
    expect(error?.message).toContain(HASH);
    expect(error?.message).toContain('contract-1');
  });

  it('does not blame a rate limit when the last look was answered', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(new RpcRateLimitedError('eth_getTransactionReceipt'))
      .mockResolvedValue(null);
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH));
    expect(error?.message).not.toContain('limiting how often');
    expect(error?.message).toContain('timed out after 60 seconds');
  });

  it('returns the receipt as soon as one look finds it', async () => {
    const read = jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ status: 1, blockNumber: 7 });
    const { value } = await settle(serviceReading(read).waitForTransaction(HASH));
    expect(value).toEqual({ status: 1, blockNumber: 7 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reports a reverted transaction as failed rather than waiting out the minute', async () => {
    const read = jest.fn().mockResolvedValue({ status: 0, blockNumber: 7 });
    const { error } = await settle(serviceReading(read).waitForTransaction(HASH));
    expect(error?.message).toBe('Transaction failed');
    expect(read).toHaveBeenCalledTimes(1);
  });
});
