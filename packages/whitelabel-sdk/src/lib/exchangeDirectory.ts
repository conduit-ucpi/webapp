/**
 * Exchanges where a person can buy a dollar stablecoin and withdraw it to their own wallet, for
 * the list in components/funding/ExchangeDirectory.
 *
 * ⚠️ A LIST OF PLACES TO LOOK, NOT OF ROUTES SEEN TO WORK. Nobody here has bought on each of these
 *    and withdrawn to our network. Exchanges differ in which networks they withdraw a token on, and
 *    change it without notice, so the list tells the reader to check the withdrawal network before
 *    buying. The routes that HAVE been seen to work are the ramps FundingOptions shows
 *    above this list (lib/krakenRamp, lib/coinbaseOnramp, lib/stripeLinkOnramp).
 *
 * `countries` are ISO codes where the exchange is a local name, used only to lift it to the top
 * for a visitor from there (lib/visitorCountry, which is advice and can be wrong). An exchange
 * with none is listed under its region and nowhere else. No link here is an affiliate link.
 *
 * Every address was requested on 2026-11-19 and answered, some only with a refusal to a script
 * (which a browser does not get). That shows the site is there, and nothing about what it sells.
 */
export interface Exchange {
  name: string;
  url: string;
  /** Where it mainly serves, in a few words, shown beside the name. */
  serves: string;
  countries?: string[];
}

export type ExchangeRegionId =
  | 'worldwide'
  | 'card-services'
  | 'north-america'
  | 'oceania'
  | 'europe'
  | 'latin-america'
  | 'africa-middle-east'
  | 'asia';

/** The region's name is a message (funding.region.*), so it is translated; `serves` is not. */
export interface ExchangeRegion {
  id: ExchangeRegionId;
  exchanges: Exchange[];
}

export const EXCHANGE_REGIONS: ExchangeRegion[] = [
  {
    id: 'worldwide',
    exchanges: [
      { name: 'Coinbase', url: 'https://www.coinbase.com', serves: 'Most countries', countries: ['US', 'GB', 'CA'] },
      { name: 'Kraken', url: 'https://www.kraken.com', serves: 'Most countries', countries: ['US', 'GB', 'CA', 'AU'] },
      { name: 'Binance', url: 'https://www.binance.com', serves: 'Most countries outside the US' },
      { name: 'OKX', url: 'https://www.okx.com', serves: 'Most countries' },
      { name: 'Bybit', url: 'https://www.bybit.com', serves: 'Most countries outside the US' },
      { name: 'Crypto.com', url: 'https://crypto.com', serves: 'Most countries' },
      { name: 'KuCoin', url: 'https://www.kucoin.com', serves: 'Most countries outside the US' },
      { name: 'Bitget', url: 'https://www.bitget.com', serves: 'Most countries outside the US' },
      { name: 'Gate', url: 'https://www.gate.com', serves: 'Most countries outside the US' },
      { name: 'MEXC', url: 'https://www.mexc.com', serves: 'Most countries outside the US' },
      { name: 'HTX', url: 'https://www.htx.com', serves: 'Most countries outside the US' },
      { name: 'Bitfinex', url: 'https://www.bitfinex.com', serves: 'Most countries outside the US' },
      { name: 'BingX', url: 'https://bingx.com', serves: 'Most countries outside the US' },
      { name: 'BitMart', url: 'https://www.bitmart.com', serves: 'Most countries' },
      { name: 'WhiteBIT', url: 'https://whitebit.com', serves: 'Europe and most countries outside the US' },
      { name: 'Bitstamp', url: 'https://www.bitstamp.net', serves: 'US, UK and Europe' },
      { name: 'Uphold', url: 'https://uphold.com', serves: 'US, UK and Europe' },
    ],
  },
  {
    id: 'card-services',
    exchanges: [
      { name: 'MoonPay', url: 'https://www.moonpay.com/buy', serves: 'Most countries' },
      { name: 'Transak', url: 'https://transak.com', serves: 'Most countries' },
      { name: 'Ramp Network', url: 'https://rampnetwork.com', serves: 'Most countries' },
      { name: 'Banxa', url: 'https://banxa.com', serves: 'Most countries' },
      { name: 'Mercuryo', url: 'https://mercuryo.io', serves: 'Most countries' },
      { name: 'Guardarian', url: 'https://guardarian.com', serves: 'Most countries' },
      { name: 'Onramp.money', url: 'https://onramp.money', serves: 'India and emerging markets', countries: ['IN'] },
    ],
  },
  {
    id: 'north-america',
    exchanges: [
      { name: 'Gemini', url: 'https://www.gemini.com', serves: 'United States', countries: ['US'] },
      { name: 'Binance.US', url: 'https://www.binance.us', serves: 'United States', countries: ['US'] },
      { name: 'Robinhood', url: 'https://robinhood.com/crypto', serves: 'United States', countries: ['US'] },
      { name: 'Newton', url: 'https://www.newton.co', serves: 'Canada', countries: ['CA'] },
      { name: 'Bitbuy', url: 'https://bitbuy.ca', serves: 'Canada', countries: ['CA'] },
      { name: 'NDAX', url: 'https://ndax.io', serves: 'Canada', countries: ['CA'] },
      { name: 'Wealthsimple', url: 'https://www.wealthsimple.com', serves: 'Canada', countries: ['CA'] },
    ],
  },
  {
    id: 'oceania',
    exchanges: [
      { name: 'Swyftx', url: 'https://swyftx.com', serves: 'Australia and New Zealand', countries: ['AU', 'NZ'] },
      { name: 'CoinSpot', url: 'https://www.coinspot.com.au', serves: 'Australia', countries: ['AU'] },
      { name: 'Independent Reserve', url: 'https://www.independentreserve.com', serves: 'Australia, New Zealand and Singapore', countries: ['AU', 'NZ', 'SG'] },
      { name: 'BTC Markets', url: 'https://www.btcmarkets.net', serves: 'Australia', countries: ['AU'] },
      { name: 'CoinJar', url: 'https://www.coinjar.com', serves: 'Australia and the UK', countries: ['AU', 'GB'] },
      { name: 'Digital Surge', url: 'https://digitalsurge.com.au', serves: 'Australia', countries: ['AU'] },
      { name: 'Easy Crypto', url: 'https://easycrypto.com', serves: 'New Zealand and Australia', countries: ['NZ', 'AU'] },
    ],
  },
  {
    id: 'europe',
    exchanges: [
      { name: 'Bitpanda', url: 'https://www.bitpanda.com', serves: 'Europe', countries: ['AT', 'DE', 'FR', 'IT', 'ES', 'PL', 'CH'] },
      { name: 'Bitvavo', url: 'https://bitvavo.com', serves: 'Europe', countries: ['NL', 'BE', 'DE', 'FR', 'AT', 'IE'] },
      { name: 'Revolut', url: 'https://www.revolut.com', serves: 'UK and Europe', countries: ['GB', 'IE', 'FR', 'ES', 'PT', 'PL', 'RO', 'LT'] },
      { name: 'Bit2Me', url: 'https://bit2me.com', serves: 'Spain and Europe', countries: ['ES', 'PT'] },
      { name: 'Young Platform', url: 'https://youngplatform.com', serves: 'Italy and Europe', countries: ['IT'] },
      { name: 'zondacrypto', url: 'https://zondacrypto.com', serves: 'Poland and Europe', countries: ['PL'] },
      { name: 'Coinmetro', url: 'https://www.coinmetro.com', serves: 'Europe' },
      { name: 'Kriptomat', url: 'https://kriptomat.io', serves: 'Europe', countries: ['EE'] },
      { name: 'BtcTurk', url: 'https://www.btcturk.com', serves: 'Türkiye', countries: ['TR'] },
      { name: 'Paribu', url: 'https://www.paribu.com', serves: 'Türkiye', countries: ['TR'] },
    ],
  },
  {
    id: 'latin-america',
    exchanges: [
      { name: 'Bitso', url: 'https://bitso.com', serves: 'Mexico, Argentina, Brazil and Colombia', countries: ['MX', 'AR', 'BR', 'CO'] },
      { name: 'Mercado Bitcoin', url: 'https://www.mercadobitcoin.com.br', serves: 'Brazil', countries: ['BR'] },
      { name: 'NovaDAX', url: 'https://www.novadax.com.br', serves: 'Brazil', countries: ['BR'] },
      { name: 'Foxbit', url: 'https://foxbit.com.br', serves: 'Brazil', countries: ['BR'] },
      { name: 'Belo', url: 'https://www.belo.app', serves: 'Argentina', countries: ['AR'] },
      { name: 'Lemon', url: 'https://www.lemon.me', serves: 'Argentina', countries: ['AR'] },
      { name: 'Ripio', url: 'https://www.ripio.com', serves: 'Argentina, Brazil and more', countries: ['AR', 'BR', 'UY', 'CO'] },
      { name: 'Buda', url: 'https://www.buda.com', serves: 'Chile, Colombia and Peru', countries: ['CL', 'CO', 'PE'] },
    ],
  },
  {
    id: 'africa-middle-east',
    exchanges: [
      { name: 'Luno', url: 'https://www.luno.com', serves: 'South Africa, Nigeria and more', countries: ['ZA', 'NG', 'KE', 'UG', 'MY'] },
      { name: 'VALR', url: 'https://www.valr.com', serves: 'South Africa', countries: ['ZA'] },
      { name: 'Yellow Card', url: 'https://yellowcard.io', serves: 'Across Africa', countries: ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'CM', 'RW', 'ZM', 'BW'] },
      { name: 'Busha', url: 'https://busha.io', serves: 'Nigeria and Kenya', countries: ['NG', 'KE'] },
      { name: 'Quidax', url: 'https://quidax.io', serves: 'Nigeria', countries: ['NG'] },
      { name: 'AltCoinTrader', url: 'https://altcointrader.co.za', serves: 'South Africa', countries: ['ZA'] },
      { name: 'OVEX', url: 'https://ovex.com', serves: 'South Africa', countries: ['ZA'] },
      { name: 'Rain', url: 'https://www.rain.com', serves: 'UAE, Bahrain and the Gulf', countries: ['AE', 'BH', 'SA', 'KW', 'OM'] },
      { name: 'BitOasis', url: 'https://bitoasis.net', serves: 'UAE and the Gulf', countries: ['AE', 'SA', 'KW', 'BH', 'OM'] },
      { name: 'M2', url: 'https://www.m2.com', serves: 'UAE', countries: ['AE'] },
    ],
  },
  {
    id: 'asia',
    exchanges: [
      { name: 'Coins.ph', url: 'https://www.coins.ph', serves: 'Philippines', countries: ['PH'] },
      { name: 'PDAX', url: 'https://pdax.ph', serves: 'Philippines', countries: ['PH'] },
      { name: 'CoinDCX', url: 'https://coindcx.com', serves: 'India', countries: ['IN'] },
      { name: 'ZebPay', url: 'https://zebpay.com', serves: 'India', countries: ['IN'] },
      { name: 'Tokocrypto', url: 'https://www.tokocrypto.com', serves: 'Indonesia', countries: ['ID'] },
      { name: 'Pintu', url: 'https://pintu.co.id', serves: 'Indonesia', countries: ['ID'] },
      { name: 'HashKey', url: 'https://www.hashkey.com', serves: 'Hong Kong', countries: ['HK'] },
      { name: 'SBI VC Trade', url: 'https://www.sbivc.co.jp', serves: 'Japan', countries: ['JP'] },
      { name: 'Bitkub', url: 'https://www.bitkub.com', serves: 'Thailand', countries: ['TH'] },
      { name: 'Indodax', url: 'https://indodax.com', serves: 'Indonesia', countries: ['ID'] },
      { name: 'Upbit', url: 'https://upbit.com', serves: 'South Korea', countries: ['KR'] },
      { name: 'Bithumb', url: 'https://www.bithumb.com', serves: 'South Korea', countries: ['KR'] },
      { name: 'Coinhako', url: 'https://www.coinhako.com', serves: 'Singapore', countries: ['SG'] },
    ],
  },
];

/** The exchanges that are local names in this country, in list order. Empty for an unknown one. */
export function exchangesIn(country: string | null | undefined): Exchange[] {
  if (!country) return [];
  return EXCHANGE_REGIONS.flatMap((region) => region.exchanges).filter((exchange) =>
    exchange.countries?.includes(country.toUpperCase())
  );
}
