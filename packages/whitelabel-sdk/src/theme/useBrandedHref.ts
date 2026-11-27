import { useCallback } from 'react';
import { useBrandSource, useOptionalBrand } from './BrandProvider';
import { shareableUrl, withBrandParam } from './brandedHref';

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
  // A brand our own domain implies is not carried: the link opens on that
  // domain, which implies it again.
  const brandId = brand && source && source !== 'default' && source !== 'host' ? brand.id : null;

  return useCallback((path: string) => withBrandParam(path, brandId), [brandId]);
}

/**
 * [shareableUrl] for the brand the page is showing: the partner's site when it frames ours,
 * else this site. For links handed to someone else; see shareableUrl.
 */
export function useShareableUrl(): (path: string) => string {
  const payPageBase = useOptionalBrand()?.payPageBase;
  return useCallback(
    (path: string) => shareableUrl(path, payPageBase, typeof window !== 'undefined' ? window.location.origin : ''),
    [payPageBase]
  );
}
