/**
 * The wallet page's conversion: out of the stablecoin that cannot be cashed out on this network
 * (USDT on Base) and into the one that can. The amount that LEAVES is the fixed one, so a whole
 * balance can go with nothing left behind.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConvertPanel from '@/components/wallet/ConvertPanel';
import { SWAP_VENUES } from '@/lib/stablecoinSwap';

const USDC = { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, name: 'USD Coin' };
const USDT = { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, name: 'Tether' };
const venue = SWAP_VENUES[8453];

let config: any;
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config }) }));
const quoteSale = jest.fn();
const sellExactInput = jest.fn();
jest.mock('@/hooks/useSimpleEthers', () => ({ useSimpleEthers: () => ({ quoteSale, sellExactInput }) }));

const onConverted = jest.fn();
const show = (balances: Record<string, string> = { USDC: '3.5', USDT: '20.000000' }) =>
  render(<ConvertPanel balances={balances} networkName="Base" onConverted={onConverted} />);
/** Type, then let the quote's wait and its answer go by. */
const enter = async (amount: string) => {
  fireEvent.change(screen.getByLabelText('Amount of USDT'), { target: { value: amount } });
  await act(async () => { await jest.advanceTimersByTimeAsync(600); });
};
const submit = () => screen.getByRole('button', { name: 'Convert USDT to USDC' });

beforeEach(() => {
  jest.useFakeTimers();
  config = { chainId: 8453, supportedTokens: [USDC, USDT] };
  quoteSale.mockReset().mockResolvedValue(BigInt(19_973_097));
  sellExactInput.mockReset().mockResolvedValue('0xhash');
  onConverted.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('the wallet page conversion', () => {
  it('starts out of USDT and into USDC, and says why', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Convert USDT to USDC' })).toBeInTheDocument();
    expect(screen.getByText(/USDT is hard to cash out on Base/)).toBeInTheDocument();
    expect(screen.getByText('Available: 20.0 USDT')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it('is not there on a network with no pool, or where only one of the two is listed', () => {
    config = { chainId: 84532, supportedTokens: [USDC, USDT] };
    expect(show().container).toBeEmptyDOMElement();
    config = { chainId: 8453, supportedTokens: [USDC] };
    expect(show().container).toBeEmptyDOMElement();
  });

  it('quotes once typing has settled, and shows what arrives and the least that can', async () => {
    show();
    fireEvent.change(screen.getByLabelText('Amount of USDT'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Amount of USDT'), { target: { value: '20' } });
    expect(quoteSale).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(600); });

    expect(quoteSale).toHaveBeenCalledTimes(1);
    expect(quoteSale).toHaveBeenCalledWith(venue, USDT.address, USDC.address, BigInt(20_000_000));
    expect(screen.getByText('You get about 19.973097 USDC.')).toBeInTheDocument();
    expect(screen.getByText(/never less than 19.873232 USDC/)).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('Max sells the whole balance: exactly that leaves, and at least the quote less half a percent arrives', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    await act(async () => { await jest.advanceTimersByTimeAsync(600); });
    await act(async () => { fireEvent.click(submit()); });

    expect(sellExactInput).toHaveBeenCalledWith(
      venue,
      { tokenIn: USDT.address, tokenInDecimals: 6, tokenOut: USDC.address, amountIn: BigInt(20_000_000), amountOutMinimum: BigInt(19_873_232) },
      {
        approve: 'Allow 20.0 USDT to be converted into USDC. Nothing is spent at this step.',
        convert: 'Convert 20.0 USDT into at least 19.873232 USDC. The USDC arrives in this same wallet.',
      }
    );
    expect(screen.getByText('Converting 20.0 USDT to USDC')).toBeInTheDocument();
    expect(onConverted).toHaveBeenCalledTimes(1);
  });

  it('will not convert more than the wallet holds', async () => {
    show();
    await enter('20.5');
    expect(screen.getByText('Amount must be greater than 0 and not exceed your balance')).toBeInTheDocument();
    expect(quoteSale).not.toHaveBeenCalled();
    expect(submit()).toBeDisabled();
  });

  it('refuses a rate more than 1% off one-for-one, on screen and again at the moment of converting', async () => {
    quoteSale.mockResolvedValue(BigInt(19_000_000));
    show();
    await enter('20');
    expect(screen.getByText(/costs too much right now/)).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    // Fair when shown, dear by the time the button is pressed.
    quoteSale.mockResolvedValue(BigInt(19_973_097));
    await enter('10');
    quoteSale.mockResolvedValue(BigInt(9_000_000));
    await act(async () => { fireEvent.click(submit()); });
    expect(sellExactInput).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('costs too much right now');
  });

  it('says so when the pool cannot quote it, and shows a failure in its own words', async () => {
    quoteSale.mockRejectedValueOnce(new Error('execution reverted'));
    show();
    await enter('20');
    expect(screen.getByText("USDT can't be converted to USDC right now. Try again in a minute.")).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    await enter('5');
    sellExactInput.mockRejectedValue(new Error('This wallet sent native tokens out in the last 24 hours'));
    await act(async () => { fireEvent.click(submit()); });
    expect(screen.getByRole('alert')).toHaveTextContent('This wallet sent native tokens out in the last 24 hours');
    expect(onConverted).not.toHaveBeenCalled();
  });

  it('converts the other way when asked', async () => {
    show();
    fireEvent.click(screen.getByLabelText('USDC'));
    expect(screen.getByRole('heading', { name: 'Convert USDC to USDT' })).toBeInTheDocument();
    expect(screen.queryByText(/hard to cash out/)).not.toBeInTheDocument();
    expect(screen.getByText('Available: 3.5 USDC')).toBeInTheDocument();
  });
});
