import { parseTokensFromEnv } from '@/types/tokens';

/**
 * What a page needs to list the ways of adding and cashing out before the browser has loaded
 * anything: which chain, which tokens, and which providers this deployment is set up for.
 *
 * ⚠️ FOR THE HTML A VISITOR OR A BOT IS SENT, so it is read from the environment alone: no RPC,
 *    no chainservice, nothing that can be slow or down. /api/config is the full answer and the
 *    browser replaces this with it once it arrives; these are the same facts, minus anything
 *    that needs a network call (token names and decimals).
 */
export interface RampFacts {
  chainId: number;
  /** Token symbols, the default one first. */
  tokenSymbols: string[];
  /** Coinbase's on-ramp and off-ramp are configured. */
  coinbase: boolean;
  /** The wallet provider sells by card (Privy's funding window). */
  card: boolean;
}

export function rampFacts(env: NodeJS.ProcessEnv = process.env): RampFacts {
  let symbols: string[] = [];
  if (env.SUPPORTED_TOKENS) {
    try {
      const tokens = parseTokensFromEnv(env.SUPPORTED_TOKENS);
      symbols = [...tokens.filter((token) => token.isDefault), ...tokens.filter((token) => !token.isDefault)].map(
        (token) => token.symbol,
      );
    } catch {
      symbols = [];
    }
  }
  if (symbols.length === 0) {
    if (env.USDC_CONTRACT_ADDRESS) symbols.push('USDC');
    if (env.USDT_CONTRACT_ADDRESS) symbols.push('USDT');
    if (env.DEFAULT_TOKEN_SYMBOL === 'USDT' && symbols.includes('USDT')) symbols = ['USDT', ...symbols.filter((s) => s !== 'USDT')];
  }
  if (symbols.length === 0) symbols = ['USDC'];
  const chainId = parseInt(env.CHAIN_ID || '8453', 10);
  return {
    chainId: Number.isFinite(chainId) ? chainId : 8453,
    tokenSymbols: symbols,
    coinbase: !!env.COINBASE_PROJECT_ID,
    card: !!env.PRIVY_APP_ID,
  };
}
