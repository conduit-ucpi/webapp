import { useCallback, useEffect, useState } from 'react';
import { visitorCountry } from '../lib/visitorCountry';
import { LINK_COUNTRIES } from '../lib/stripeLinkOnramp';

export interface LinkAvailability {
  /** True only when we know the country and Link does not sell there. */
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
 * Whether Stripe's Link page is worth offering this buyer: it sells in the United States only.
 * As with Coinbase (useCoinbaseAvailability), an unknown country leaves it available and a known
 * one can be overruled: the country is advice, and must never block a payment.
 */
export function useLinkAvailability(): LinkAvailability {
  const [elsewhere, setElsewhere] = useState<string | null>(null);
  const [overruled, setOverruled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void visitorCountry().then((country) => {
      if (!cancelled && country && !LINK_COUNTRIES.includes(country)) setElsewhere(country);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const overrule = useCallback(() => setOverruled(true), []);
  return {
    unavailable: !!elsewhere && !overruled,
    countryName: elsewhere ? nameOf(elsewhere) : null,
    overrule,
  };
}
