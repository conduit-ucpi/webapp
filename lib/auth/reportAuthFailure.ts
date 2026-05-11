/**
 * Client helper to log an auth failure to /api/telemetry/auth-failure.
 *
 * Fire-and-forget: never throws, never blocks the calling flow. Failure to
 * report telemetry is non-fatal and intentionally swallowed — the user
 * already has bigger problems if telemetry can't reach the server.
 */

export type AuthFailureKindForTelemetry =
  | 'wallet-signing'
  | 'network'
  | 'unknown'
  | 'magic-blocked';

export type AuthFailureContext =
  | 'pre-flight'
  | 'siwe-verify'
  | 'request-authentication';

export function reportAuthFailure(
  kind: AuthFailureKindForTelemetry,
  context: AuthFailureContext,
  message?: string
): void {
  if (typeof fetch === 'undefined') return;
  try {
    void fetch('/api/telemetry/auth-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, context, message }),
      keepalive: true,
    }).catch(() => {
      // Telemetry failure must not affect user-facing behaviour.
    });
  } catch {
    // Same — never throw.
  }
}
