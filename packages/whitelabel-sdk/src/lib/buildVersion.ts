/**
 * Build versions for the two independently-deployed halves of the app.
 *
 * Until the static-frontend migration there was one version, read from
 * /api/config — correct, because the same container served the HTML and the
 * API. That is no longer true: the frontend ships from GitHub Pages and the API
 * from the box (STATIC_FRONTEND_MIGRATION_PLAN.md), so the two deploy
 * separately and drift. Reporting only the API's version silently misattributes
 * a stale frontend to the backend, which is exactly the confusion that prompted
 * this: Pages was serving current code while /api/config reported a tag from
 * weeks earlier, because the two point at different deployments.
 *
 * CLIENT_* is inlined at build time (NEXT_PUBLIC_*, so it reaches the bundle).
 * The API's version continues to come from /api/config at runtime.
 */

/** Tag of the build that produced this bundle. Empty when built outside CI. */
export const CLIENT_GIT_TAG = process.env.NEXT_PUBLIC_GIT_TAG || '';

/** Short SHA of the build that produced this bundle. */
export const CLIENT_GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || '';

/**
 * "tag • sha", omitting either half when absent or literally 'unknown' — the
 * placeholder /api/config returns when the box was built without the env var.
 * Returns '' when nothing useful is known, so callers can hide the row.
 */
export function formatVersion(tag?: string | null, sha?: string | null): string {
  const parts = [tag, sha]
    .map((v) => (v || '').trim())
    .filter((v) => v !== '' && v !== 'unknown');
  return parts.join(' • ');
}
