/**
 * Runs once when the Node server starts (Next.js instrumentation hook).
 *
 * Masks personal data in every server-side log line before it is written — see
 * lib/server/redactPii.ts for why this is done here rather than at each call site. The static
 * export has no server, so there is nothing to install there; the Edge runtime has no console
 * worth wrapping for our routes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installLogRedaction } = await import('./lib/server/redactPii');
    installLogRedaction();
  }
}
