import fs from 'fs';
import path from 'path';
import * as sdk from '@conduit-ucpi/whitelabel-sdk';

/**
 * The Coinbase flows live in the SDK end to end: the code that opens Coinbase, the page Coinbase
 * returns to, and the cash-out panel. A tenant gets all of it, and the app's own routes are thin
 * re-exports of the SDK like every other product page.
 */
describe('SDK: Coinbase surfaces', () => {
  it('exports the return pages and the cash-out panel', () => {
    expect(typeof sdk.OnrampReturnPage).toBe('function');
    expect(typeof sdk.OfframpReturnPage).toBe('function');
    expect(typeof sdk.CashOutPanel).toBe('function');
  });

  it("mounts each return page at the exact path the SDK's Coinbase code returns to", () => {
    const lib = (f: string) => fs.readFileSync(path.join(__dirname, '../../packages/whitelabel-sdk/src/lib', f), 'utf8');
    expect(lib('coinbaseOnramp.ts')).toMatch(/ONRAMP_RETURN_ROUTE = '\/onramp-return'/);
    expect(lib('coinbaseOfframp.ts')).toMatch(/OFFRAMP_RETURN_ROUTE = '\/offramp-return'/);

    const route = (f: string) => fs.readFileSync(path.join(__dirname, '../../pages', f), 'utf8');
    expect(route('onramp-return.tsx')).toMatch(/export \{ OnrampReturnPage as default \} from '@conduit-ucpi\/whitelabel-sdk'/);
    expect(route('offramp-return.tsx')).toMatch(/export \{ OfframpReturnPage as default \} from '@conduit-ucpi\/whitelabel-sdk'/);
  });

  it('leaves no app-only copy of either component behind', () => {
    for (const f of ['components/coinbase/CoinbaseReturnScreen.tsx', 'components/wallet/CashOutPanel.tsx']) {
      expect(fs.existsSync(path.join(__dirname, '../..', f))).toBe(false);
    }
  });
});
