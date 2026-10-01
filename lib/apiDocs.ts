import { API_BASE } from '@/lib/apiFetch';

/**
 * The escrow API's browsable reference: /prepare, /settle and the rest of ap2service.
 *
 * ⚠️ ON THE API HOST, NOT THE APP HOST. In production the app is static pages on stabledrop.me and
 *    the API is api.stabledrop.me, so a relative link would land on a page that does not exist.
 *    Falls back to the deployed API host where API_BASE is empty (the box build).
 */
export const API_DOCS_URL = `${API_BASE || 'https://api.stabledrop.me'}/api/ap2/settle/doc`;
