/**
 * Detects the site name based on the current domain
 */
export function getSiteNameFromDomain(): string {
  if (typeof window === 'undefined') {
    return 'StableDrop'; // Server-side default
  }

  const hostname = window.location.hostname.toLowerCase();

  // Map domains to site names
  if (hostname.includes('stabledrop.me')) {
    return 'StableDrop';
  }

  if (hostname.includes('instantescrow')) {
    return 'Instant Escrow';
  }

  if (hostname.includes('conduit-ucpi')) {
    return 'Conduit UCPI';
  }

  if (hostname.includes('usdcbay')) {
    return 'USDCBAY';
  }

  // Default fallback
  return 'StableDrop';
}
