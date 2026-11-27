import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { visitorCountry } from '../lib/visitorCountry';

export interface CoinbaseAvailability {
  /** True only when we know the country and Coinbase cannot take money there. */
  unavailable: boolean;
  /** The country's name, in the browser's language, for saying why. */
  countryName: string | null;
  /** "Not in this country?": the country can be wrong, so the buyer can overrule it. */
  overrule: () => void;
}

function nameOf(country: string): string {
  try {
    return new Intl.DisplayNames([navigator.language], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

/**
 * Whether Coinbase's own routes are worth offering this buyer. Anything unknown (no country, a failed
 * lookup) leaves them available: this saves a wasted trip, and must never block a payment.
 */
export function useCoinbaseAvailability(enabled: boolean): CoinbaseAvailability {
  const [unsupportedCountry, setUnsupportedCountry] = useState<string | null>(null);
  const [overruled, setOverruled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const country = await visitorCountry();
        if (!country) return;
        const response = await apiFetch(`/api/coinbase/onramp-support?country=${country}`, { credentials: 'omit' });
        const body = await response.json();
        if (!cancelled && response.ok && body.supported === false) setUnsupportedCountry(country);
      } catch {
        // Unknown, so nothing is greyed out.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const overrule = useCallback(() => setOverruled(true), []);
  return {
    unavailable: !!unsupportedCountry && !overruled,
    countryName: unsupportedCountry ? nameOf(unsupportedCountry) : null,
    overrule,
  };
}
