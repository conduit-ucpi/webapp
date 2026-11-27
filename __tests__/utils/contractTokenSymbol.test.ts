import { contractTokenSymbol } from '@/utils/currency';

describe('contractTokenSymbol', () => {
  it.each([
    [{ currencySymbol: 'USDT', currency: 'microUSDC' }, 'USDT'], // the symbol is what it was paid in
    [{ currencySymbol: 'USDC' }, 'USDC'],
    [{ currency: 'microUSDT' }, 'USDT'],
    [{ currency: 'USDT' }, 'USDT'],
    [{ currency: 'USDC' }, 'USDC'],
    [{ currency: 'USD' }, 'USDC'], // old records wrote dollars, and were all USDC
    [{ currencySymbol: '  ', currency: '' }, 'USDC'],
    [{ currencySymbol: '<b>x</b>' }, 'USDC'],
    [{}, 'USDC'],
  ])('%j is %s', (contract, symbol) => {
    expect(contractTokenSymbol(contract)).toBe(symbol);
  });
});
