/**
 * The wallet page is the three things done with a wallet, in the order money moves: add it (the
 * same list /buy-token and the payment screen show), cash it out (Coinbase, or by hand through an
 * exchange) and send it on.
 */
import { render, screen, within } from '@testing-library/react';
import Wallet from '@/pages/wallet';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const USDC = { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, name: 'USD Coin' };
const USDT = { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, name: 'Tether' };

const auth = {
  user: { userId: '1', email: 'test@example.com', walletAddress: WALLET },
  state: { isConnected: false },
  isLoading: false,
  canFundWallet: () => true,
  fundWallet: jest.fn(),
};
jest.mock('@/components/auth', () => ({ useAuth: () => auth }));
jest.mock('@/components/auth/SimpleAuthProvider', () => ({ useAuth: () => auth }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: { chainId: 8453, tokenSymbol: 'USDC', defaultToken: USDC, supportedTokens: [USDC, USDT], coinbaseProjectId: 'p' },
  }),
}));
jest.mock('@/components/auth/ConnectWalletEmbedded', () => ({ __esModule: true, default: () => <button>Connect</button> }));
jest.mock('@/hooks/useWalletAddress', () => ({ useWalletAddress: () => ({ walletAddress: WALLET, isLoading: false }) }));
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
jest.mock('@/hooks/useCoinbaseAvailability', () => ({
  useCoinbaseAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
jest.mock('@/hooks/useOnrampMinimum', () => ({ useOnrampMinimum: () => null }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/coinbaseOnramp', () => ({ ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return', openCoinbaseOnramp: jest.fn() }));

const section = (id: string) => document.getElementById(id) as HTMLElement;

describe('the wallet page', () => {
  beforeEach(() => render(<Wallet />));

  it('links to its three sections from the top', () => {
    expect(screen.getByRole('link', { name: 'Add money' })).toHaveAttribute('href', '#add');
    expect(screen.getByRole('link', { name: 'Cash out' })).toHaveAttribute('href', '#cash-out');
    expect(screen.getByRole('link', { name: 'Send' })).toHaveAttribute('href', '#send');
  });

  it('shows the whole address with a button to copy it', () => {
    expect(screen.getAllByLabelText('Your wallet address')[0]).toHaveValue(WALLET);
  });

  it('adds money with the same list as /buy-token: the ramps, then more places to buy', () => {
    const add = within(section('add'));
    expect(add.getByRole('heading', { name: 'Add USDC' })).toBeInTheDocument();
    expect(add.getByRole('button', { name: /Add from Coinbase/ })).toBeInTheDocument();
    expect(add.getByRole('button', { name: /Add from Kraken/ })).toBeInTheDocument();
    expect(add.getByText('More places to buy USDC')).toBeInTheDocument();
    expect(add.getByLabelText('Token to add')).toHaveValue('USDC');
  });

  it('cashes out through Coinbase, or by hand through an exchange', () => {
    const cashOut = within(section('cash-out'));
    expect(cashOut.getByText('the Coinbase cash-out panel')).toBeInTheDocument();
    expect(cashOut.getByText('Cash out USDC through an exchange')).toBeInTheDocument();
    expect(cashOut.getByText(/choose to deposit USDC and pick/)).toHaveTextContent('Base as the network');
    expect(cashOut.getByText(/Only use a deposit address it gives you for Base/)).toBeInTheDocument();
    expect(cashOut.getByText('Kraken')).toBeInTheDocument();
  });

  it('leaves the card services out of cashing out, and does not show this wallet as the destination', () => {
    const cashOut = within(section('cash-out'));
    expect(cashOut.queryByText('MoonPay')).toBeNull();
    expect(cashOut.queryByLabelText('Your wallet address')).toBeNull();
  });

  it('sends to another wallet, which is where an exchange deposit is made from', () => {
    const send = within(section('send'));
    expect(send.getByRole('heading', { name: 'Send to another wallet' })).toBeInTheDocument();
    expect(send.getByText(/an exchange's deposit address/)).toBeInTheDocument();
    expect(send.getByLabelText('Recipient Address')).toBeInTheDocument();
  });
});
