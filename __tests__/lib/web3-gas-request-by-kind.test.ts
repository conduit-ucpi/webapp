/**
 * How the wallet's gas is asked for depends on what it is about to send.
 *
 * A token transfer names the transfer (/api/chain/fund-transfer): chainservice checks the wallet
 * holds the tokens, sizes the gas from its own simulation, and refuses a wallet that has been
 * sending native tokens out. Nothing else is given gas: there is no ask-by-amount any more.
 * A wallet that already holds enough asks for nothing.
 */

import { ethers } from 'ethers';
import { Web3Service } from '@/lib/web3';

const apiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));

const USER = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ESCROW = '0x9a4264b3173fa692bdd159cb226e4ae491e2989c';
const NEEDED = BigInt(1_560_000_000_000);

const erc20 = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
]);
const transfer = { to: TOKEN, data: erc20.encodeFunctionData('transfer', [ESCROW, 12091900]), value: '0' };
const approval = { to: TOKEN, data: erc20.encodeFunctionData('approve', [ESCROW, 12091900]), value: '0' };
const vote = { to: ESCROW, data: new ethers.Interface(['function submitResolutionVote(uint256)']).encodeFunctionData('submitResolutionVote', [50]), value: '0' };
const sendEth = { to: ESCROW, data: '0x', value: '1000000000000000' };

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body });

function service(balance: bigint | null = BigInt(0)) {
  Web3Service.clearInstance();
  const svc = Web3Service.getInstance({ rpcUrl: 'https://rpc.example', chainId: 8453, gasPriceBuffer: '1.2' } as any) as any;
  jest.spyOn(svc, 'readNativeBalance').mockResolvedValue(balance);
  return svc;
}

const posted = () => apiFetch.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(json(200, { success: true, funded: true, reason: 'FUNDED', message: 'Gas for this transfer has been sent.', amountWei: NEEDED.toString() }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  Web3Service.clearInstance();
});

describe('asking for gas', () => {
  it('a token transfer names the transfer, and never an amount of gas to be given', async () => {
    const funded = await service().topUpGasIfShort(USER, NEEDED, transfer);

    expect(funded).toBe(true);
    expect(posted()).toEqual([
      {
        url: '/api/chain/fund-transfer',
        body: { walletAddress: USER, tokenAddress: TOKEN, toAddress: ESCROW, amount: '12091900', neededWei: NEEDED.toString() }
      }
    ]);
    expect(posted()[0].body.totalAmountNeededWei).toBeUndefined();
  });

  it.each([
    ['an approval', approval],
    ['a vote on a payment contract', vote]
  ])('%s has no gas route: the wallet is told it must pay, and nothing is asked for', async (_what, tx) => {
    await expect(service().topUpGasIfShort(USER, NEEDED, tx)).rejects.toThrow('Add a little ETH on Base');

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('sending native token asks for nothing: a wallet sending ETH has ETH to pay its own gas', async () => {
    // Even with a balance too small to cover the gas: it is the wallet's own to find.
    expect(await service(BigInt(0)).topUpGasIfShort(USER, NEEDED, sendEth)).toBe(false);
    expect(await service(BigInt(0)).topUpGasIfShort(USER, NEEDED, { ...sendEth, value: '0x38d7ea4c68000' })).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('a wallet that already holds enough asks for nothing, whatever it is sending', async () => {
    const svc = service(NEEDED);
    expect(await svc.topUpGasIfShort(USER, NEEDED, transfer)).toBe(false);
    expect(await svc.topUpGasIfShort(USER, NEEDED, vote)).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('chainservice finding the wallet already has enough is not a failure, and not a top-up', async () => {
    apiFetch.mockResolvedValue(json(200, { success: true, funded: false, reason: 'ALREADY_HAS_GAS', message: 'The wallet already holds enough for this transfer.', amountWei: '0' }));
    expect(await service().topUpGasIfShort(USER, NEEDED, transfer)).toBe(false);
  });

  it.each([
    [400, 'NATIVE_SENT_OUT', 'This wallet sent native tokens out in the last 24 hours, so its gas is not paid for. It can pay its own gas, or try again later.'],
    [400, 'NO_TOKENS', 'The wallet holds 0 of that token, less than the 12091900 it wants to send.'],
    [503, 'HISTORY_UNAVAILABLE', "This wallet's history could not be checked. Try again."]
  ])("a refusal (%i %s) stops the send with chainservice's own sentence", async (status, reason, message) => {
    apiFetch.mockResolvedValue(json(status, { success: false, funded: false, reason, message }));
    await expect(service().topUpGasIfShort(USER, NEEDED, transfer)).rejects.toThrow(message);
  });

  it('a refused transfer is not then asked for the older way', async () => {
    apiFetch.mockResolvedValue(json(400, { success: false, funded: false, reason: 'NATIVE_SENT_OUT', message: 'refused' }));
    await service().topUpGasIfShort(USER, NEEDED, transfer).catch(() => {});
    expect(posted().map(post => post.url)).toEqual(['/api/chain/fund-transfer']);
  });

  it('an answer that cannot be read is a failure, with something to say', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
    await expect(service().topUpGasIfShort(USER, NEEDED, transfer)).rejects.toThrow(/could not be arranged \(502\)/);
  });
});
