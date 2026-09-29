import { apiUrl } from '../lib/apiFetch';
import { BrandConfig } from './types';

/**
 * Reading brands from the white-label service (../whitelabelservice).
 *
 * Every brand, our own included, is a record there. The app bundles a snapshot
 * of them (config/brands/snapshot.json) so the first paint needs no request and
 * the site survives the service being down; BrandProvider then fetches the live
 * record through here.
 */

/** A GridFS ObjectId — how the service names an uploaded file. */
const ASSET_ID = /^[0-9a-f]{24}$/;

/** A brand id, as the service accepts them. Anything else is never requested. */
export const BRAND_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

export const BRAND_FETCH_TIMEOUT_MS = 4000;

/**
 * URL for an asset reference. An uploaded asset's id becomes its URL on the
 * API host; a path on our own site (`/favicon.ico`) is returned as it is.
 */
export function brandAssetUrl(brandId: string, ref: string): string {
  if (ASSET_ID.test(ref)) {
    return apiUrl(`/api/brands/${encodeURIComponent(brandId)}/assets/${ref}`);
  }
  return ref;
}

/** Outcome of a fetch. `missing` and `unreachable` are handled differently by the caller. */
export type BrandFetchResult =
  | { status: 'found'; config: BrandConfig; version: number }
  | { status: 'missing' }
  | { status: 'unreachable' };

/**
 * Fetch one brand.
 *
 * `missing` (a 404) means the id is not a brand, so the page should fall back
 * to ours. `unreachable` means we could not tell, so the page should keep
 * whatever copy it already has.
 *
 * No cookies are sent: the endpoint is public, and a credentialed request
 * would needlessly tie brand loading to the session.
 */
export async function fetchBrand(
  id: string,
  { timeoutMs = BRAND_FETCH_TIMEOUT_MS, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<BrandFetchResult> {
  if (!BRAND_ID_PATTERN.test(id)) return { status: 'missing' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(apiUrl(`/api/brands/${id}`), {
      credentials: 'omit',
      signal: controller.signal,
    });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'unreachable' };
    const body = await res.json();
    const config = parseServedBrand(id, body?.config);
    if (!config) return { status: 'unreachable' };
    return { status: 'found', config, version: Number(body.version) || 0 };
  } catch {
    return { status: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Minimal shape check on what the service returned. The service validates on
 * write; this only guards against rendering something that is plainly not a
 * brand, or a record filed under the wrong id.
 */
export function parseServedBrand(id: string, raw: unknown): BrandConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as BrandConfig;
  if (config.id !== id || typeof config.name !== 'string' || !config.name) return null;
  // Deployment config, never a brand's to set. See BrandConfig.apiBaseUrl.
  const { apiBaseUrl: _ignored, ...rest } = config;
  return rest;
}
