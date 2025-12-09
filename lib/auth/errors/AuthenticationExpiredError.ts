/**
 * Error thrown when the backend JWT has expired
 *
 * This indicates that the user's wallet is still connected,
 * but the backend session cookie (AUTH-TOKEN) has expired.
 * The solution is to request a fresh SIWE signature to get a new JWT.
 */
export class AuthenticationExpiredError extends Error {
  constructor(message: string = 'Authentication session expired') {
    super(message);
    this.name = 'AuthenticationExpiredError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationExpiredError);
    }
  }
}
