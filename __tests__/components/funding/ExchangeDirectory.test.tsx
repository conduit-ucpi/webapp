/**
 * The list of companies to buy from. Whole on /buy-token, where it is there to be read; in parts
 * on the pay screen, which shows the card services to one buyer and the exchanges to another, and
 * leads with the visitor's own part of the world.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExchangeDirectory from '@/components/funding/ExchangeDirectory';

let mockCountry: string | null = null;
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(mockCountry) }));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const directory = (extra: Record<string, unknown> = {}) => (
  <ExchangeDirectory tokenSymbol="USDC" networkName="Base" walletAddress={WALLET} chainId={8453} amount={40} {...extra} />
);
const headings = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const links = () => screen.getAllByRole('link').map((link) => link.textContent ?? '');

beforeEach(() => {
  mockCountry = null;
});

describe('ExchangeDirectory', () => {
  it('lists everything, every region open, where it is not told otherwise', () => {
    render(directory());
    expect(links()).toHaveLength(79);
    expect(headings()[0]).toBe('Card services');
    expect(screen.queryByRole('button', { name: 'Show all countries' })).toBeNull();
  });

  describe('the card services alone', () => {
    it('are the seven of them, with what to give them and no steps about withdrawing', () => {
      render(directory({ show: 'card-services' }));
      expect(links()).toHaveLength(7);
      expect(screen.getByText(/Not exchanges: there is nothing to withdraw/)).toBeInTheDocument();
      expect(screen.queryByText(/Withdraw or send it/)).toBeNull();
      expect((screen.getByLabelText('Your wallet address') as HTMLInputElement).value).toBe(WALLET);
      expect(screen.getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
    });

    it('open with the purchase filled in where a company takes it that way', () => {
      render(directory({ show: 'card-services' }));
      const moonPay = new URL(screen.getByRole('link', { name: /MoonPay/ }).getAttribute('href')!);
      expect(moonPay.searchParams.get('quoteCurrencyAmount')).toBe('40');
      expect(screen.getByRole('link', { name: /Transak/ })).toHaveAttribute('href', 'https://global.transak.com');
    });

    it("lift the visitor's own to the front without listing it twice", async () => {
      mockCountry = 'IN';
      render(directory({ show: 'card-services' }));
      await waitFor(() => expect(links()[0]).toMatch(/^Onramp\.money/));
      expect(links()).toHaveLength(7);
    });
  });

  describe('the exchanges alone', () => {
    it('leave the card services out', () => {
      render(directory({ show: 'exchanges' }));
      expect(links()).toHaveLength(72);
      expect(headings()).not.toContain('Card services');
      expect(screen.getByText(/Withdraw or send it/)).toBeInTheDocument();
    });
  });

  describe("leading with the visitor's own region", () => {
    it('shows worldwide and their region, and the rest on asking', async () => {
      mockCountry = 'AU';
      render(directory({ show: 'exchanges', ownRegionFirst: true }));
      await waitFor(() => expect(headings()).toContain('Popular in Australia'));
      // Every exchange in their region is a local name there, so the region is the "Popular in" group.
      expect(headings()).toEqual(['Popular in Australia', 'Worldwide']);
      expect(screen.getByRole('link', { name: /^Swyftx/ })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Bitso/ })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Show all countries' }));
      expect(links()).toHaveLength(72);
      expect(screen.getByRole('link', { name: /^Bitso/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show all countries' })).toBeNull();
    });

    it("shows the rest of the visitor's region under its own name, beside the local ones", async () => {
      mockCountry = 'FR';
      render(directory({ show: 'exchanges', ownRegionFirst: true }));
      await waitFor(() => expect(headings()).toContain('UK and Europe'));
      expect(headings()).not.toContain('Latin America');
      expect(headings()).not.toContain('Asia');
      expect(screen.getByRole('link', { name: /^Bitpanda/ })).toBeInTheDocument();
    });

    it('shows worldwide alone for a country that is unknown, or in no region listed', async () => {
      render(directory({ show: 'exchanges', ownRegionFirst: true }));
      expect(headings()).toEqual(['Worldwide']);
      expect(screen.getByRole('button', { name: 'Show all countries' })).toBeInTheDocument();
    });

    it('keeps the card services in view when the whole list is shown that way', () => {
      render(directory({ ownRegionFirst: true }));
      expect(headings()).toEqual(['Card services', 'Worldwide']);
    });
  });
});
