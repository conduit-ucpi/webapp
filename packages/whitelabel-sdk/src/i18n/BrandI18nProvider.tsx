import React from 'react';
import { useOptionalBrand } from '../theme/BrandProvider';
import { I18nProvider } from './I18nProvider';

/**
 * I18nProvider wired to the active brand's locale.
 *
 * Kept as its own component so I18nProvider stays independent of branding and
 * can be used on its own. Must sit inside BrandProvider.
 */
export function BrandI18nProvider({ children }: { children: React.ReactNode }) {
  const brand = useOptionalBrand();
  return <I18nProvider brandLocale={brand?.locale}>{children}</I18nProvider>;
}
