import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { BrandConfig, ResolvedBrand } from '../config/types';
import { resolveBrand } from '../config/resolveBrand';
import { brandToVars, applyVars } from './cssVars';

/**
 * Holds the tenant's brand and puts its theme variables on the document.
 *
 * Wrap the app once. Everything below can then read the brand with useBrand(),
 * and every Tailwind colour class already follows the theme through the
 * variables — see cssVars.ts for why that indirection exists.
 *
 * Variables are written in an effect rather than during render because they
 * touch the document element, which is outside React's tree. The defaults are
 * already present from globals.css, so the pre-hydration paint is correct and
 * this only ever applies a tenant's deltas.
 */

const BrandContext = createContext<ResolvedBrand | null>(null);

export interface BrandProviderProps {
  brand: BrandConfig;
  children: React.ReactNode;
}

export function BrandProvider({ brand, children }: BrandProviderProps) {
  const resolved = useMemo(() => resolveBrand(brand), [brand]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyVars(brandToVars(resolved), document.documentElement);
  }, [resolved]);

  return <BrandContext.Provider value={resolved}>{children}</BrandContext.Provider>;
}

/**
 * The active brand.
 *
 * Throws when used outside the provider rather than returning a default: a
 * component silently rendering the SDK's own colours inside a tenant's app is
 * the kind of bug that ships, and a missing provider is trivially fixable.
 */
export function useBrand(): ResolvedBrand {
  const brand = useContext(BrandContext);
  if (!brand) {
    throw new Error(
      'useBrand() was called outside <BrandProvider>. Wrap the app in BrandProvider ' +
        'and pass it your brand config.'
    );
  }
  return brand;
}

/** The brand if there is one, otherwise null. For optional chrome. */
export function useOptionalBrand(): ResolvedBrand | null {
  return useContext(BrandContext);
}
