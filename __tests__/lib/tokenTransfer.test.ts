/**
 * Which transactions are a plain token transfer. Those ask for gas by naming the transfer; the
 * rest ask the older way. Being wrong must always fall towards "not a transfer".
 */

import { ethers } from 'ethers';
import { asTokenTransfer, sendsNativeValue } from '@/lib/tokenTransfer';

const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TO = '0x9a4264b3173fa692bdd159cb226e4ae491e2989c';
const erc20 = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)'
]);
const transfer = erc20.encodeFunctionData('transfer', [TO, 12091900]);

describe('recognising a token transfer', () => {
  it('reads the token, the recipient and the amount from a transfer', () => {
    expect(asTokenTransfer({ to: TOKEN, data: transfer, value: '0' })).toEqual({
      tokenAddress: TOKEN,
      toAddress: TO,
      amount: '12091900'
    });
  });

  it.each([undefined, '', '0', '0x0', '0x', '0x00'])('treats a value of %s as sending no native token', value => {
    expect(asTokenTransfer({ to: TOKEN, data: transfer, value })).not.toBeNull();
  });

  it('reads the selector whatever its case', () => {
    expect(asTokenTransfer({ to: TOKEN, data: transfer.toUpperCase().replace('0X', '0x') })?.amount).toBe('12091900');
  });

  it('reads an amount far larger than a number can hold', () => {
    const huge = '1606938044258990275541962092341162602522202993782792835301376'; // 2^200
    expect(asTokenTransfer({ to: TOKEN, data: erc20.encodeFunctionData('transfer', [TO, huge]) })?.amount).toBe(huge);
  });

  it.each([
    ['an approval', erc20.encodeFunctionData('approve', [TO, 12091900])],
    ['a transferFrom', erc20.encodeFunctionData('transferFrom', [TO, TO, 1])],
    ['a vote on a payment contract', new ethers.Interface(['function submitResolutionVote(uint256)']).encodeFunctionData('submitResolutionVote', [50])],
    ['a call with no arguments', '0x6daa2d44'],
    ['no call data at all', '0x'],
    ['a transfer with something after its arguments', transfer + '00'.repeat(32)],
    ['a transfer cut short', transfer.slice(0, -2)],
    ['a transfer of nothing', erc20.encodeFunctionData('transfer', [TO, 0])],
    ['a recipient with its upper bytes set', '0xa9059cbb' + 'ff'.repeat(12) + TO.slice(2) + '00'.repeat(31) + '01'],
    ['data that is not hex', '0xa9059cbb' + 'zz'.repeat(64)]
  ])('does not treat %s as a transfer', (_what, data) => {
    expect(asTokenTransfer({ to: TOKEN, data, value: '0' })).toBeNull();
  });

  it('does not treat a transfer that also sends native token as one', () => {
    expect(asTokenTransfer({ to: TOKEN, data: transfer, value: '1' })).toBeNull();
    expect(asTokenTransfer({ to: TOKEN, data: transfer, value: '0x1' })).toBeNull();
    expect(asTokenTransfer({ to: TOKEN, data: transfer, value: 'lots' })).toBeNull();
  });

  it('does not treat a call to something that is not an address as one', () => {
    expect(asTokenTransfer({ to: 'the token', data: transfer })).toBeNull();
    expect(asTokenTransfer({ to: undefined as any, data: transfer })).toBeNull();
  });
});

describe('whether a transaction sends native token', () => {
  it.each([undefined, '', '0', '0x0', '0x', '0x00'])('%s sends none', value => {
    expect(sendsNativeValue(value)).toBe(false);
  });

  it.each(['1', '0x1', '1000000000000000', '0x38d7ea4c68000'])('%s sends some', value => {
    expect(sendsNativeValue(value)).toBe(true);
  });

  it('a value that cannot be read counts as sending some, so no gas is handed out on a doubt', () => {
    expect(sendsNativeValue('lots')).toBe(true);
  });
});
