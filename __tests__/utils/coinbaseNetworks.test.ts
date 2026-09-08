/**
 * Test: utils/coinbaseNetworks
 *
 * The chain the cash-out runs on is derived here rather than configured twice.
 * These slugs are Coinbase's, not ours, and they are not the obvious guesses —
 * they were read back from the live CDP API. Getting one wrong sends a user's
 * real tokens on a chain Coinbase is not watching for their order, so the exact
 * spellings are pinned.
 */

import { coinbaseNetworkForChainId, supportedCoinbaseChainIds } from '@/utils/coinbaseNetworks';

describe('coinbaseNetworkForChainId', () => {
  it.each([
    [8453, 'base'],
    [1, 'ethereum'],
    [137, 'polygon'],
    [10, 'optimism'],
    [42161, 'arbitrum'],
    // Not 'avalanche-c-chain', which is the natural guess and is wrong.
    [43114, 'avacchain'],
  ])('maps chain %i to %s', (chainId, expected) => {
    expect(coinbaseNetworkForChainId(chainId)).toBe(expected);
  });

  it.each([
    ['Base Sepolia', 84532],
    ['Sepolia', 11155111],
    ['Optimism Sepolia', 11155420],
    ['Arbitrum Sepolia', 421614],
    ['Avalanche Fuji', 43113],
  ])('returns undefined for %s — Coinbase has no testnets', (_name, chainId) => {
    expect(coinbaseNetworkForChainId(chainId)).toBeUndefined();
  });

  it('returns undefined for a chain Coinbase does not support', () => {
    // BNB Smart Chain is in the app's own network list but not Coinbase's.
    expect(coinbaseNetworkForChainId(56)).toBeUndefined();
  });

  it('returns undefined for an unknown chain rather than guessing a slug', () => {
    expect(coinbaseNetworkForChainId(999999)).toBeUndefined();
  });

  it('covers the mainnets this app is deployed to', () => {
    expect(supportedCoinbaseChainIds()).toEqual(expect.arrayContaining([1, 8453, 137]));
  });
});
