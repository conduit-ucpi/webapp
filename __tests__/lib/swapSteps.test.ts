/**
 * Only the two calls a conversion is made of are asked for as conversion steps: an approval of a
 * router we list, and that router's exactOutputSingle paying out to the sender.
 */
import { ethers } from 'ethers';
import { asSwapApproval, asSwapConversion } from '@/lib/swapSteps';
import { SWAP_VENUES, encodeSwap } from '@/lib/stablecoinSwap';
import { Web3Service } from '@/lib/web3';

const apiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));

const USER = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const OTHER = '0xc44a241abfcfb942a77d01dc24478526ae3a2cbe';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const venue = SWAP_VENUES[8453];
const erc20 = new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']);

const approval = (spender: string, amount: bigint | number = 5025000) => ({ to: USDC, data: erc20.encodeFunctionData('approve', [spender, amount]), value: '0' });
const conversion = (recipient: string) => ({
  to: venue.router,
  data: encodeSwap(venue, { tokenIn: USDC, tokenOut: USDT, recipient, amountOut: BigInt(5000000), amountInMaximum: BigInt(5025000) }),
  value: '0'
});

describe('recognising the approval', () => {
  it('an approval of our router is one', () => {
    expect(asSwapApproval(approval(venue.router))).toEqual({ tokenAddress: USDC, amount: '5025000' });
  });

  it.each([
    ['an approval of anything else', approval(OTHER)],
    ['an approval of nothing', approval(venue.router, 0)],
    ['one sending native value', { ...approval(venue.router), value: '1' }],
    ['one with bytes tacked on', { ...approval(venue.router), data: approval(venue.router).data + '00' }],
    ['a conversion', conversion(USER)]
  ])('%s is not', (_what, tx) => {
    expect(asSwapApproval(tx)).toBeNull();
  });
});

describe('recognising the conversion', () => {
  it('our router converting into the sender\'s own wallet is one', () => {
    expect(asSwapConversion(conversion(USER), USER.toLowerCase())).toEqual({
      tokenIn: USDC, tokenOut: USDT, amountOut: '5000000', amountInMaximum: '5025000'
    });
  });

  it.each([
    ['one paying out to somebody else', conversion(OTHER)],
    ['the same call on a contract that is not our router', { ...conversion(USER), to: OTHER }],
    ['one sending native value', { ...conversion(USER), value: '1' }],
    ['some other call on the router', { to: venue.router, data: '0x12345678', value: '0' }],
    ['an approval', approval(venue.router)]
  ])('%s is not', (_what, tx) => {
    expect(asSwapConversion(tx, USER)).toBeNull();
  });
});

describe('asking for a conversion\'s gas', () => {
  const NEEDED = BigInt(1_560_000_000_000);
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body });
  const posted = () => apiFetch.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

  function service() {
    Web3Service.clearInstance();
    const svc = Web3Service.getInstance({ rpcUrl: 'https://rpc.example', chainId: 8453, gasPriceBuffer: '1.2' } as any) as any;
    jest.spyOn(svc, 'readNativeBalance').mockResolvedValue(BigInt(0));
    return svc;
  }

  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(json(200, { success: true, funded: true, reason: 'FUNDED', message: 'sent', amountWei: NEEDED.toString() }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Web3Service.clearInstance();
  });

  it('the approval names the token and the amount, and never the spender or an amount of gas to be given', async () => {
    expect(await service().topUpGasIfShort(USER, NEEDED, approval(venue.router))).toBe(true);
    expect(posted()).toEqual([
      { url: '/api/chain/fund-swap-approval', body: { walletAddress: USER, tokenAddress: USDC, amount: '5025000', neededWei: NEEDED.toString() } }
    ]);
  });

  it('the conversion names its terms, and never the recipient', async () => {
    expect(await service().topUpGasIfShort(USER, NEEDED, conversion(USER))).toBe(true);
    expect(posted()).toEqual([
      {
        url: '/api/chain/fund-swap',
        body: { walletAddress: USER, tokenIn: USDC, tokenOut: USDT, amountOut: '5000000', amountInMaximum: '5025000', neededWei: NEEDED.toString() }
      }
    ]);
  });

  it('already approved means nothing was sent and the step goes ahead', async () => {
    apiFetch.mockResolvedValue(json(200, { success: true, funded: false, reason: 'ALREADY_APPROVED', message: 'no approval is needed', amountWei: '0' }));
    expect(await service().topUpGasIfShort(USER, NEEDED, approval(venue.router))).toBe(false);
  });

  it('a refusal stops the step with chainservice\'s own sentence, and is not retried the older way', async () => {
    apiFetch.mockResolvedValue(json(400, { success: false, funded: false, reason: 'NATIVE_SENT_OUT', message: 'This wallet sent native tokens out in the last 24 hours, so its gas is not paid for.' }));

    await expect(service().topUpGasIfShort(USER, NEEDED, conversion(USER))).rejects.toThrow('This wallet sent native tokens out in the last 24 hours');
    expect(posted().map((p) => p.url)).toEqual(['/api/chain/fund-swap']);
  });

  it('an approval of something that is not our router is not given gas at all', async () => {
    await expect(service().topUpGasIfShort(USER, NEEDED, approval(OTHER))).rejects.toThrow('Add a little ETH on Base');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
