import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { BrandConfig, ResolvedBrand } from '../config/types';
import { BrandRegistry, BrandSource } from '../config/registry';
import { resolveBrand } from '../config/resolveBrand';
import { brandToVars, applyVars } from './cssVars';
import { useBrandResolution } from './useBrandResolution';

/**
 * Holds the active brand and puts its theme variables on the document.
 *
 * Two forms:
 *
 *   <BrandProvider brand={config}>                    one fixed brand
 *   <BrandProvider brands={registry} defaultBrandId>  resolved per visitor
 *
 * The second is the white-label case: a partner links to us with `?b=<id>`, and
 * the brand is then held for the session. See config/registry.ts for why the
 * parameter carries it rather than the referrer.
 *
 * Variables are written in an effect because they touch the document element,
 * which is outside React's tree. The defaults are already present from
 * globals.css, so the pre-hydration paint is correct and this only applies the
 * active brand's deltas.
 */

interface BrandContextValue {
  brand: ResolvedBrand;
  /** Where the brand came from. Useful when debugging a partner's link. */
  source: BrandSource;
}

const BrandContext = createContext<BrandContextValue | null>(null);

type BrandProviderProps = {
  children: React.ReactNode;
} & (
  | {
      brand: BrandConfig;
      brands?: never;
      defaultBrandId?: never;
      contractBrandId?: never;
      routeBrandId?: never;
    }
  | {
      brand?: never;
      brands: BrandRegistry;
      defaultBrandId: string;
      /** Partner recorded on the contract in view, when there is one. */
      contractBrandId?: string | null;
      /** Partner this route is dedicated to, when it is one. */
      routeBrandId?: string | null;
    }
);

export function BrandProvider(props: BrandProviderProps) {
  const { children } = props;

  // A registry is always passed to the hook so its call order never changes;
  // the single-brand form becomes a registry of one.
  const registry: BrandRegistry = useMemo(
    () => (props.brand ? { [props.brand.id]: props.brand } : props.brands),
    [props.brand, props.brands]
  );
  const fallbackId = props.brand ? props.brand.id : props.defaultBrandId;

  const { id, source } = useBrandResolution({
    registry,
    fallbackId,
    contractBrandId: props.brand ? undefined : props.contractBrandId,
    routeBrandId: props.brand ? undefined : props.routeBrandId,
  });

  const value = useMemo<BrandContextValue>(() => {
    const config = registry[id] ?? registry[fallbackId];
    return { brand: resolveBrand(config), source };
  }, [registry, id, fallbackId, source]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyVars(brandToVars(value.brand), document.documentElement);
  }, [value.brand]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/**
 * The active brand.
 *
 * Throws outside the provider rather than returning a default: a component
 * silently rendering our colours inside a partner's page is the kind of bug
 * that ships, and a missing provider is trivially fixable.
 */
export function useBrand(): ResolvedBrand {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error(
      'useBrand() was called outside <BrandProvider>. Wrap the app in BrandProvider ' +
        'and pass it a brand config or a registry.'
    );
  }
  return ctx.brand;
}

/** The brand if there is one, otherwise null. For chrome that is shared with non-SDK pages. */
export function useOptionalBrand(): ResolvedBrand | null {
  return useContext(BrandContext)?.brand ?? null;
}

/** Where the active brand came from — route, contract, query or default. */
export function useBrandSource(): BrandSource | null {
  return useContext(BrandContext)?.source ?? null;
}
