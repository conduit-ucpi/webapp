/**
 * A payment page shows the partner recorded on its contract.
 *
 * A payer arrives days later from a link that may have lost `?b=`; the contract is the one
 * signal they cannot edit, so once it has loaded its brand outranks the URL.
 */
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { BrandProvider, useBrand, useBrandSource, useContractBrand, BrandRegistry } from '@conduit-ucpi/whitelabel-sdk';

const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  __esModule: true,
  default: { events: { on: jest.fn(), off: jest.fn() }, replace: (...args: unknown[]) => mockReplace(...args) },
}));

const REGISTRY: BrandRegistry = {
  stabledrop: { id: 'stabledrop', name: 'Stabledrop.me' },
  cobro: { id: 'cobro', name: 'COBRO' },
  'escrow-me': { id: 'escrow-me', name: 'Escrow Me' },
};

function Probe() {
  return <span data-testid="brand">{useBrand().name}|{useBrandSource()}</span>;
}
const text = () => screen.getByTestId('brand').textContent;

let setContractBrand: (id: string | null | undefined) => void = () => {};
let setShowPage: (show: boolean) => void = () => {};

function PaymentPage() {
  const [brandId, setBrandId] = useState<string | null | undefined>(undefined);
  setContractBrand = setBrandId;
  useContractBrand(brandId);
  return null;
}

function App() {
  const [show, setShow] = useState(true);
  setShowPage = setShow;
  return (
    <BrandProvider brands={REGISTRY} defaultBrandId="stabledrop">
      {show && <PaymentPage />}
      <Probe />
    </BrandProvider>
  );
}

afterEach(() => window.history.replaceState({}, '', '/'));

describe('useContractBrand', () => {
  it("shows the contract's partner once the record has loaded, on a link with no ?b=", () => {
    window.history.replaceState({}, '', '/contract-pay?contractId=1');
    render(<App />);
    expect(text()).toBe('Stabledrop.me|default');

    act(() => setContractBrand('Escrow-Me'));
    expect(text()).toBe('Escrow Me|contract');
  });

  it('outranks a ?b= naming someone else', () => {
    window.history.replaceState({}, '', '/contract-pay?contractId=1&b=cobro');
    render(<App />);
    expect(text()).toBe('COBRO|query');

    act(() => setContractBrand('escrow-me'));
    expect(text()).toBe('Escrow Me|contract');
  });

  it('leaves the brand to the URL when the contract has none', () => {
    window.history.replaceState({}, '', '/contract-pay?contractId=1&b=cobro');
    render(<App />);
    act(() => setContractBrand(null));
    expect(text()).toBe('COBRO|query');
  });

  it('hands the partner on, like any in-app move, when the page goes', () => {
    window.history.replaceState({}, '', '/contract-pay?contractId=1');
    render(<App />);
    act(() => setContractBrand('escrow-me'));
    act(() => setShowPage(false));
    expect(text()).toBe('Escrow Me|contract');
    expect(mockReplace).toHaveBeenCalledWith('/contract-pay?contractId=1&b=escrow-me', undefined, { shallow: true, scroll: false });
  });
});
