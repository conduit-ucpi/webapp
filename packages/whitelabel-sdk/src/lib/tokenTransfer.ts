/**
 * Recognise a plain ERC-20 `transfer(to, amount)` in a transaction about to be sent.
 *
 * Gas for a token transfer is asked for by naming the transfer (/api/chain/fund-transfer), not
 * by naming an amount of gas: chainservice then checks the wallet holds the tokens, simulates
 * the transfer to size the gas, and refuses a wallet that has been sending native tokens out.
 * Every other call still asks the older way. This is what tells the two apart.
 *
 * ⚠️ EXACTLY `transfer`, AND NOTHING THAT MERELY RESEMBLES IT. The selector, two 32-byte
 *    arguments and no more, an address in the first with its upper bytes clear, an amount above
 *    zero, and no native value sent with it. Anything else is not answered as a transfer: the
 *    caller falls back to the older request, which is the safe direction to be wrong in.
 */
const TRANSFER_SELECTOR = 'a9059cbb';

export interface TokenTransfer {
  /** The token contract: where the transaction is sent. */
  tokenAddress: string;
  /** Who receives the tokens. */
  toAddress: string;
  /** In the token's smallest unit, as a decimal string. */
  amount: string;
}

function sendsNoValue(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === '0x') return true;
  try {
    return BigInt(value) === BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Whether a transaction sends native token with it. One that does is never given gas: the wallet
 * holds native token, by definition, and pays its own way. Unreadable counts as "does", since
 * the question is whether to hand out gas and the safe answer to a doubt is no.
 */
export function sendsNativeValue(value: string | undefined): boolean {
  return !sendsNoValue(value);
}

export function asTokenTransfer(tx: { to: string; data: string; value?: string }): TokenTransfer | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(tx.to ?? '') || typeof tx.data !== 'string') return null;
  const data = tx.data.toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(data) || data.length !== 2 + 8 + 64 + 64) return null;
  if (data.slice(2, 10) !== TRANSFER_SELECTOR) return null;
  if (!sendsNoValue(tx.value)) return null;

  const recipient = data.slice(10, 74);
  if (!/^0{24}/.test(recipient)) return null;
  const amount = BigInt('0x' + data.slice(74));
  if (amount <= BigInt(0)) return null;

  return { tokenAddress: tx.to, toAddress: '0x' + recipient.slice(24), amount: amount.toString() };
}
