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

/**
 * The facts for a page being written at BUILD time (getStaticProps).
 *
 * ⚠️ THE SITE AT stabledrop.me IS A STATIC EXPORT (scripts/build-static-export.sh, Cloudflare
 *    Pages): there is no server at request time, so a page cannot use getServerSideProps, and the
 *    export build has none of the server's environment (CHAIN_ID, COINBASE_PROJECT_ID, ...).
 *    A first version of this used getServerSideProps and broke the cherry release's export
 *    (2026-11-20: "pages with getServerSideProps can not be exported").
 *
 *    So the export asks the RUNNING API for its config, as that script already does for the MCP
 *    card, and the page is baked with what is actually deployed. It fails the build rather than
 *    publish a page that silently leaves Coinbase or the card route out. The box build has the
 *    environment and reads it directly.
 */
export async function rampFactsAtBuild(env: NodeJS.ProcessEnv = process.env): Promise<RampFacts> {
  if (env.STATIC_EXPORT !== 'true') return rampFacts(env);
  const base = (env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set: cannot ask the API which ramps it has.');
  const response = await fetch(`${base}/api/config`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${base}/api/config answered ${response.status}: cannot list the ramps.`);
  return rampFactsFromConfig(await response.json());
}

/** The same facts, taken from /api/config's answer. */
export function rampFactsFromConfig(config: {
  chainId?: number;
  supportedTokens?: { symbol: string }[];
  defaultToken?: { symbol: string } | null;
  coinbaseProjectId?: string;
  privyAppId?: string;
}): RampFacts {
  const first = config.defaultToken?.symbol;
  const rest = (config.supportedTokens ?? []).map((token) => token.symbol).filter((symbol) => symbol !== first);
  const tokenSymbols = [...(first ? [first] : []), ...rest];
  return {
    chainId: typeof config.chainId === 'number' ? config.chainId : 8453,
    tokenSymbols: tokenSymbols.length > 0 ? tokenSymbols : ['USDC'],
    coinbase: !!config.coinbaseProjectId,
    card: !!config.privyAppId,
  };
}
