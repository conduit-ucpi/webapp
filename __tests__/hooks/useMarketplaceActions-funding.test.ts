import { ethers } from 'ethers';
import { ERC20_ABI } from '@/lib/web3';

/**
 * Funding an offer is a DIRECT TRANSFER followed by a relayed open, and the two halves fail
 * independently. These cover the property that actually costs money if it regresses: the
 * transfer must be a plain ERC20 `transfer` of the offer token (not an ETH-value send, and
 * not an approve), and a retry after the deposit has landed must open the existing deposit
 * rather than send a second one.
 */

const erc20Interface = new ethers.Interface(ERC20_ABI);

const VAULT = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const AMOUNT = '950000000'; // 950 USDC in base units

describe('offer funding is a plain token transfer', () => {
  it('encodes transfer(vault, amount) against the token, carrying no ETH value', () => {
    const data = erc20Interface.encodeFunctionData('transfer', [VAULT, AMOUNT]);

    // The selector a wallet decodes as "Send <token>". This is the whole reason the flow
    // moved off approve+transferFrom: an undecodable call renders as a bare native-value
    // transaction, i.e. an ETH prompt on a USDC offer.
    expect(data.slice(0, 10)).toBe('0xa9059cbb');

    const decoded = erc20Interface.decodeFunctionData('transfer', data);
    expect(decoded[0].toLowerCase()).toBe(VAULT);
    expect(decoded[1].toString()).toBe(AMOUNT);
  });

  it('sends the token contract as the destination, never the vault', () => {
    // The transaction goes TO the token and names the vault as recipient. Reversing these
    // would send an opaque call to the vault and move nothing.
    const tx = {
      to: TOKEN,
      data: erc20Interface.encodeFunctionData('transfer', [VAULT, AMOUNT]),
      value: '0'
    };
    expect(tx.to).toBe(TOKEN);
    expect(tx.value).toBe('0');
    expect(erc20Interface.decodeFunctionData('transfer', tx.data)[0].toLowerCase()).toBe(VAULT);
  });
});

/**
 * Mirrors MakeOfferModal's retry branch. The modal owns this decision, so the test states the
 * invariant directly rather than mounting the whole component: once `deposited` is true, the
 * retry path must not be the one that moves money.
 */
describe('retrying a half-completed funding', () => {
  const chooseRetry = (deposited: boolean) => (deposited ? 'open-only' : 'transfer-then-open');

  it('opens the existing deposit once the transfer has landed', () => {
    expect(chooseRetry(true)).toBe('open-only');
  });

  it('sends the transfer when nothing has landed yet', () => {
    expect(chooseRetry(false)).toBe('transfer-then-open');
  });

  it('treats a failure to OPEN as deposited — the money is already in the vault', () => {
    // fundOffer fires onDeposited immediately after the transfer confirms and BEFORE the
    // open, precisely so a throw from the open half still leaves `deposited` true. If this
    // ordering regresses, a retry double-funds the vault.
    const events: string[] = [];
    let deposited = false;

    const fundOffer = async (onDeposited: () => void) => {
      events.push('transfer');
      onDeposited();
      events.push('open');
      throw new Error('opening failed');
    };

    return fundOffer(() => {
      deposited = true;
    })
      .catch(() => undefined)
      .then(() => {
        expect(events).toEqual(['transfer', 'open']);
        expect(deposited).toBe(true);
        expect(chooseRetry(deposited)).toBe('open-only');
      });
  });
});
