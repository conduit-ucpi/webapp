import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/apiFetch';

/**
 * Where the payment API is, for the commands and addresses a page shows people to copy.
 *
 * The static site is built knowing it (API_BASE). The box build serves the API from its own host,
 * so there it is wherever the page was loaded from — known only in the browser, hence after mount
 * (the first render matches the server's, so hydration never disagrees).
 *
 * ⚠️ NEVER A HOST WRITTEN INTO THE CODE: each environment shows its own.
 */
export function useApiOrigin(): string {
  const [origin, setOrigin] = useState(API_BASE);
  useEffect(() => {
    if (!API_BASE && typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  return origin;
}

/**
 * Where the site is: the origin this page was loaded from, known only in the browser (after mount,
 * so the first render matches the server's). The static site is the site, in every environment.
 */
export function useSiteOrigin(): string {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  return origin;
}
