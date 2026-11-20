/**
 * @jest-environment node
 *
 * What the server writes for /wallet, which is what a search engine or an AI agent reads. The
 * server never has a user and has loaded no config, and the page used to be a spinner until both
 * arrived: the HTML sent had no content at all (2026-11-20). It now lists every way to add money
 * and to cash out, from what the server itself knows.
 */
import { renderToString } from 'react-dom/server';
import Wallet, { getServerSideProps } from '@/pages/wallet';
import { rampFacts } from '@/lib/server/rampFacts';

// The server's view: sign-in unresolved, no config yet.
const auth = { user: null, state: null, isLoading: true, canFundWallet: () => false, fundWallet: jest.fn() };
jest.mock('@/components/auth', () => ({ useAuth: () => auth }));
jest.mock('@/components/auth/SimpleAuthProvider', () => ({ useAuth: () => auth }));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config: null, isLoading: true }) }));
jest.mock('@/components/auth/ConnectWalletEmbedded', () => ({ __esModule: true, default: () => <button>Connect</button> }));
jest.mock('@/hooks/useWalletAddress', () => ({ useWalletAddress: () => ({ walletAddress: null, isLoading: true }) }));
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: jest.fn(),
    getNativeBalance: jest.fn(),
    getTokenBalance: jest.fn(),
    getUserAddress: jest.fn(),
  }),
}));
jest.mock('@/components/farcaster/FarcasterDetectionProvider', () => ({ useFarcaster: () => ({ isInFarcaster: false }) }));
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ CashOutPanel: () => <div>the Coinbase cash-out panel</div> }));
jest.mock('@/lib/rpc/RpcClient', () => ({ RpcClient: class {}, sharedRpcClient: jest.fn() }));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/coinbaseOnramp', () => ({ ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return', openCoinbaseOnramp: jest.fn() }));
jest.mock('@/hooks/useOnrampMinimum', () => ({ useOnrampMinimum: () => null }));
jest.mock('@/components/SEO', () => ({ __esModule: true, default: () => null }));

const BASE = { chainId: 8453, tokenSymbols: ['USDC', 'USDT'], coinbase: true, card: true };
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('/wallet as the server writes it', () => {
  const html = renderToString(<Wallet ramps={BASE} />);
  const page = text(html);

  it('is the page, not a spinner: its title and its three sections', () => {
    expect(page).toContain('Wallet Management');
    expect(html).toContain('id="add"');
    expect(html).toContain('id="cash-out"');
    expect(html).toContain('id="send"');
  });

  it('lists every way to add money, naming the token and the network', () => {
    expect(page).toContain('Add USDC');
    expect(page).toContain('Add funds with a card');
    expect(page).toContain('Add from Coinbase');
    expect(page).toContain('Add from Kraken');
    expect(page).toContain('Transfer from another wallet');
    expect(page).toContain('Base');
    // Kraken and Link are not written off for want of a chain: the server knows which one.
    expect(page).not.toMatch(/cannot deliver|can't deliver/i);
  });

  it('lists the exchanges to buy on, as links', () => {
    expect(page).toContain('Worldwide');
    expect(html).toMatch(/<a href="https:\/\/[^"]+"[^>]*target="_blank"/);
  });

  it('says how to cash out: through Coinbase, and by hand through an exchange', () => {
    expect(page).toContain('Cash out your tokens');
    expect(page).toContain('Cash out USDC through an exchange');
  });

  it('offers nothing to press, and asks for no amount: there is no wallet to deliver to', () => {
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(html).not.toContain('id="funding-amount"');
    // Sign-in has not settled, so not even the connect button yet.
    expect(html).not.toContain('<button>Connect</button>');
  });

  it('leaves out the providers this deployment does not have', () => {
    const without = text(renderToString(<Wallet ramps={{ ...BASE, coinbase: false, card: false }} />));
    expect(without).not.toContain('Add from Coinbase');
    expect(without).not.toContain('Add funds with a card');
    expect(without).not.toContain('Cash out your tokens');
    expect(without).toContain('Add from Kraken');
    expect(without).toContain('Cash out USDC through an exchange');
  });
});

describe('what the server knows without asking anyone', () => {
  it('reads the chain, the tokens (default first) and the providers from the environment', () => {
    expect(
      rampFacts({ CHAIN_ID: '8453', USDC_CONTRACT_ADDRESS: '0x1', USDT_CONTRACT_ADDRESS: '0x2', DEFAULT_TOKEN_SYMBOL: 'USDT', COINBASE_PROJECT_ID: 'p' } as never),
    ).toEqual({ chainId: 8453, tokenSymbols: ['USDT', 'USDC'], coinbase: true, card: false });
  });

  it('falls back to USDC on Base with nothing set, rather than writing an empty page', () => {
    expect(rampFacts({} as never)).toEqual({ chainId: 8453, tokenSymbols: ['USDC'], coinbase: false, card: false });
  });

  it('is what getServerSideProps hands the page', async () => {
    const result = (await getServerSideProps({} as never)) as { props: { ramps: unknown } };
    expect(result.props.ramps).toEqual(rampFacts());
  });
});
