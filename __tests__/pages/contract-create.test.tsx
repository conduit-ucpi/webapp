/**
 * /contract-create: a merchant's checkout, which is /pay with the merchant's terms.
 *
 * The payment itself is PayPage's and is tested in pay.test.tsx. What matters here is the
 * translation both ways, because it is the contract with plugins already installed on merchants'
 * sites (CONTRACT_CREATE_API.md): URL parameters in, and postMessage events, the webhook call,
 * the Shopify order and the WordPress redirects out.
 */

import { render, screen, act } from '@testing-library/react';
import type { PaidEscrow, PayCheckout } from '@/pages/PayPage';

const push = jest.fn();
const replace = jest.fn();
const mockRouter: { query: Record<string, string>; isReady: boolean } = { query: {}, isReady: true };
jest.mock('next/router', () => ({
  useRouter: () => ({ push, replace, pathname: '/contract-create', asPath: '/contract-create', ...mockRouter }),
}));

const authenticatedFetch = jest.fn();
jest.mock('@/components/auth', () => ({
  useAuth: () => ({ user: { email: 'buyer@example.com' }, authenticatedFetch }),
}));
const apiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
// Where the page sends the browser, observed rather than followed: jsdom does not navigate.
const redirected = jest.fn((url: string) => url);
jest.mock('@/utils/safeRedirect', () => ({ safeRedirectUrl: (url: string) => redirected(url) }));

// PayPage stands in as a probe: the wrapper's whole job is what it passes in and what it does with
// what comes back.
let checkout: PayCheckout | undefined;
jest.mock('@/pages/PayPage', () => ({
  __esModule: true,
  default: (props: { checkout?: PayCheckout }) => {
    checkout = props.checkout;
    return <div data-testid="pay-page" />;
  },
}));

import ContractCreate from '@/pages/contract-create';

const SELLER = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const TX = '0x' + 'cd'.repeat(32);
const PAID = { contractId: '507f1f77bcf86cd799439011', escrowAddress: ESCROW, txHash: TX };

const parentPost = jest.fn();
const openerPost = jest.fn();
const openerLocation = { href: '' };
const closeSpy = jest.fn();

function embed(as: 'iframe' | 'popup' | 'page') {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: as === 'iframe' ? { postMessage: parentPost } : window,
  });
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: as === 'popup' ? { postMessage: openerPost, location: openerLocation } : null,
  });
}

function open(query: Record<string, string>) {
  mockRouter.query = { seller: SELLER, amount: '100.00', description: 'Order 456', ...query };
  return render(<ContractCreate />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  checkout = undefined;
  mockRouter.isReady = true;
  openerLocation.href = '';
  window.close = closeSpy;
  authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  embed('page');
});

afterEach(() => {
  jest.useRealTimers();
  embed('page');
});

async function pay(paid: PaidEscrow = PAID) {
  await act(async () => {
    await checkout!.onPaid(paid);
  });
  act(() => {
    jest.advanceTimersByTime(2000);
  });
}

describe('/contract-create: parameters in', () => {
  it("hands PayPage the merchant's terms, locked", () => {
    open({ tokenSymbol: 'USDT', epoch_expiry: '1900000000' });
    expect(screen.getByTestId('pay-page')).toBeInTheDocument();
    expect(checkout!.terms).toEqual({
      seller: SELLER,
      amount: '100.00',
      description: 'Order 456',
      expiryTimestamp: 1900000000,
      tokenSymbol: 'USDT',
    });
  });

  it('epoch_expiry=0 is an instant payment', () => {
    open({ epoch_expiry: '0' });
    expect(checkout!.terms.expiryTimestamp).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['in the past', '1000'],
    ['not a number', 'soon'],
  ])('a payout date that is %s defaults to seven days out', (_, epoch) => {
    open(epoch === undefined ? {} : { epoch_expiry: epoch });
    const sevenDays = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    expect(Math.abs(checkout!.terms.expiryTimestamp - sevenDays)).toBeLessThan(5);
  });

  it('the default payout date does not move between renders (it is part of the escrow address)', () => {
    const { rerender } = open({});
    const first = checkout!.terms.expiryTimestamp;
    jest.advanceTimersByTime(60_000);
    rerender(<ContractCreate />);
    expect(checkout!.terms.expiryTimestamp).toBe(first);
  });

  it.each([
    [{ order_id: '456' }, 'webhook URL'],
    [{ webhook_url: 'https://shop.example/webhook' }, 'order ID'],
  ])('refuses a WordPress link the store could not reconcile (%o)', (extra, missing) => {
    open({ wordpress_source: 'true', ...extra });
    expect(screen.queryByTestId('pay-page')).toBeNull();
    expect(screen.getByText(new RegExp(`missing its ${missing}`))).toBeInTheDocument();
  });

  it('without merchant terms, sends the visitor to /pay', () => {
    mockRouter.query = { seller: SELLER };
    render(<ContractCreate />);
    expect(screen.queryByTestId('pay-page')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/pay');
  });
});

describe('/contract-create: paid', () => {
  it('verifies the payment with the merchant webhook, from the receipt', async () => {
    open({ webhook_url: 'https://shop.example/webhook', order_id: '456' });
    await pay();

    expect(authenticatedFetch).toHaveBeenCalledWith('/api/payment/verify-and-webhook', expect.anything());
    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({
      transaction_hash: TX,
      contract_address: ESCROW,
      contract_hash: ESCROW,
      contract_id: PAID.contractId,
      webhook_url: 'https://shop.example/webhook',
      order_id: 456,
      expected_amount: 100,
      expected_recipient: ESCROW,
      merchant_wallet: SELLER,
    });
  });

  it('calls no webhook without a funding transaction to verify, as before', async () => {
    open({ webhook_url: 'https://shop.example/webhook' });
    await pay({ ...PAID, txHash: undefined });
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it('creates the Shopify order', async () => {
    open({ shop: 'mystore.myshopify.com', product_id: '789', variant_id: '012', title: 'Blue T-Shirt', quantity: '2', order_id: '345' });
    await pay();

    expect(apiFetch).toHaveBeenCalledWith('/api/shopify/create-order', expect.anything());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
      shop: 'mystore.myshopify.com',
      orderId: '345',
      contractId: PAID.contractId,
      productId: '789',
      variantId: '012',
      title: 'Blue T-Shirt',
      price: '100.00',
      quantity: 2,
      buyerEmail: 'buyer@example.com',
      transactionHash: TX,
    });
  });

  it('in a popup, tells the opener (conduit-checkout.js verifies by contractId) and closes', async () => {
    embed('popup');
    open({ order_id: '456' });
    await pay();

    const types = openerPost.mock.calls.map(([event]) => event.type);
    expect(types).toEqual(['contract_created', 'payment_completed']);
    expect(openerPost.mock.calls[1][0].data).toEqual({
      contractId: PAID.contractId,
      amount: '100.00',
      description: 'Order 456',
      seller: SELLER,
      orderId: '456',
      transactionHash: TX,
      contractAddress: ESCROW,
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('in an iframe, tells the parent and asks it to close the modal', async () => {
    embed('iframe');
    open({});
    await pay();

    expect(parentPost.mock.calls.map(([event]) => event.type)).toEqual(['contract_created', 'payment_completed', 'close_modal']);
    expect(openerPost).not.toHaveBeenCalled();
  });

  it('as a page, goes back to WordPress with the completed status', async () => {
    open({ wordpress_source: 'true', order_id: '456', webhook_url: 'https://shop.example/webhook', return: 'https://shop.example/order-received/456/?key=wc_order_abc' });
    await pay();

    const url = new URL(redirected.mock.calls.at(-1)![0]);
    expect(url.pathname).toBe('/usdc-payment-status/456/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'wc_order_abc',
      payment_status: 'completed',
      contract_id: PAID.contractId,
      contract_hash: ESCROW,
      tx_hash: TX,
    });
  });

  it('as a page with no return address, goes to the dashboard', async () => {
    open({});
    await pay();
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});

describe('/contract-create: failed or cancelled', () => {
  const WP = { wordpress_source: 'true', order_id: '456', webhook_url: 'https://shop.example/webhook', return: 'https://shop.example/order-received/456/?key=wc_order_abc' };

  it('a payment that could not be set up is reported, and the buyer stays to try again', () => {
    embed('popup');
    open(WP);
    act(() => checkout!.onFailed('The minimum payment is $1.', 'prepare'));

    expect(openerPost).toHaveBeenCalledWith({ type: 'payment_error', error: 'The minimum payment is $1.' }, '*');
    expect(openerLocation.href).toBe('');
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('a failed payment sends WordPress to its error page', () => {
    open(WP);
    act(() => checkout!.onFailed('User rejected the request', 'pay'));

    const url = new URL(redirected.mock.calls.at(-1)![0]);
    expect(url.searchParams.get('payment_status')).toBe('error');
    expect(url.searchParams.get('error')).toBe(encodeURIComponent('User rejected the request'));
  });

  it('cancelling in a popup reports it, sends WordPress to cancelled, and closes', () => {
    embed('popup');
    open(WP);
    act(() => checkout!.onCancel());

    expect(openerPost).toHaveBeenCalledWith({ type: 'payment_cancelled' }, '*');
    expect(new URL(openerLocation.href).searchParams.get('payment_status')).toBe('cancelled');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('cancelling in an iframe asks the parent to close the modal', () => {
    embed('iframe');
    open({});
    act(() => checkout!.onCancel());
    expect(parentPost.mock.calls.map(([event]) => event.type)).toEqual(['payment_cancelled', 'close_modal']);
  });
});
