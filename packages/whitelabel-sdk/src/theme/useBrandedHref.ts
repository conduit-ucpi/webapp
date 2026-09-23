import { useCallback } from 'react';
import { useBrandSource, useOptionalBrand } from './BrandProvider';
import { withBrandParam } from './brandedHref';

/**
 * Build in-app links that keep the visitor on the brand they arrived on.
 *
 * Returns the path unchanged when the brand is our own default, so our own
 * URLs stay clean — `?b=stabledrop` on every link would be noise, and the
 * default is what a bare URL already means.
 */
export function useBrandedHref(): (path: string) => string {
  const brand = useOptionalBrand();
  const source = useBrandSource();

  // 'default' means nothing asked for this brand, so there is nothing to carry.
  const brandId = brand && source && source !== 'default' ? brand.id : null;

  return useCallback((path: string) => withBrandParam(path, brandId), [brandId]);
}
