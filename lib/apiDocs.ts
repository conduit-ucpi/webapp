import { useApiOrigin } from '@/lib/useApiOrigin';

/** The escrow API's browsable reference — /prepare, /settle and the rest of ap2service — on the API host. */
export const API_DOCS_PATH = '/api/ap2/settle/doc';

/**
 * The reference's address in this environment.
 *
 * ⚠️ ON THE API HOST, NOT THE APP HOST. The static site and the API are different hosts in
 *    production, so a link relative to the page would land nowhere. useApiOrigin says which host
 *    the API is on here; no host is written into the code.
 */
export function useApiDocsUrl(): string {
  return `${useApiOrigin()}${API_DOCS_PATH}`;
}
