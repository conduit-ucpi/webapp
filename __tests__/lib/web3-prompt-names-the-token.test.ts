/**
 * The in-app notice shown over the wallet prompt says what is being approved: how much, of which
 * token, to whom. It read "USDC" (and used USDC's decimals) whatever was moving, so a USDT payment
 * was announced as USDC; and it named the token contract as the recipient.
 */

import { ethers } from 'ethers';
import { Web3Service } from '@/lib/web3';
import { Config } from '@/types';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const DAI18 = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
const UNLISTED = '0x4200000000000000000000000000000000000006';
const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';

const config = {
  rpcUrl: 'https://mainnet.base.org',
  chainId: 8453,
  usdcContractAddress: USDC,
  contractFactoryAddress: '0x0000000000000000000000000000000000000000',
  maxGasPriceGwei: '50',
  maxGasCostGwei: '0.01',
  minGasWei: '1000000000',
  gasPriceBuffer: '1.2',
  usdcGrantFoundryGas: '100000',
  resolutionVoteFoundryGas: '80000',
  raiseDisputeFoundryGas: '150000',
  claimFundsFoundryGas: '150000',
  basePath: 'https://test.example.com',
  explorerBaseUrl: 'https://basescan.org',
  serviceLink: 'https://test.example.com',
  moonPayApiKey: 'test',
  supportedTokens: [
    { symbol: 'USDC', address: USDC, decimals: 6, name: 'USD Coin' },
    { symbol: 'USDT', address: USDT, decimals: 6, name: 'Tether USD' },
    { symbol: 'DAI', address: DAI18, decimals: 18, name: 'Dai' },
  ],
} as unknown as Config;

const erc20 = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

function describe_(to: string, data: string): string {
  const service = Web3Service.getInstance(config) as any;
  return service.describeTransactionForPrompt({ to, data });
}

describe('the notice over the wallet prompt', () => {
  it.each([
    ['USDC', USDC, '10000000', '10.0'],
    ['USDT', USDT, '10000000', '10.0'],
    // Its own decimals, not USDC's: 2.5 DAI is not 2500000000000 of anything.
    ['DAI', DAI18, '2500000000000000000', '2.5'],
  ])('names %s when that is the token being sent', (symbol, token, units, shown) => {
    const summary = describe_(token, erc20.encodeFunctionData('transfer', [ESCROW, units]));
    expect(summary).toBe(`sending ${shown} ${symbol} to 0x7b0e…F51B`);
  });

  it('names who receives the tokens, not the token contract', () => {
    const summary = describe_(USDT, erc20.encodeFunctionData('transfer', [ESCROW, '1000000']));
    expect(summary).toContain('0x7b0e…F51B');
    expect(summary).not.toContain('0xfde4');
  });

  it('names the token and the spender of an approval', () => {
    const summary = describe_(USDT, erc20.encodeFunctionData('approve', [ESCROW, '5000000']));
    expect(summary).toBe('approving 5.0 USDT to be spent by 0x7b0e…F51B');
  });

  it('matches the token whatever the case of its address', () => {
    const summary = describe_(USDT.toLowerCase(), erc20.encodeFunctionData('transfer', [ESCROW, '1000000']));
    expect(summary).toContain('USDT');
  });

  it('states no figure for a token it does not list: a vague warning is safe, a wrong one is not', () => {
    const summary = describe_(UNLISTED, erc20.encodeFunctionData('transfer', [ESCROW, '1000000']));
    expect(summary).toBe('submitting a transaction to 0x4200…0006');
    expect(summary).not.toMatch(/USDC|USDT/);
  });
});
