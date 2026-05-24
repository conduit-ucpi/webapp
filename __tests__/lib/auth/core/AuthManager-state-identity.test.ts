/**
 * Regression: AuthManager state must be referentially STABLE when nothing
 * actually changed.
 *
 * Root cause of the contract-pay re-render/re-fetch loop:
 *   - getState() returned `{ ...this.state }` — a NEW object on every call.
 *   - setState() always replaced this.state with a new object and notified
 *     listeners, even when the patch didn't change any value.
 *
 * React providers seed `useState(() => authManager.getState())` and update via
 * subscribe(). SimpleAuthProvider's authValue useMemo depends on
 * `newAuth.state`, so a new state object on every notification re-derived
 * authenticatedFetch/refreshUserData, which re-fired contract-pay's effects,
 * which called back into auth (updateUserData -> setState), which notified
 * again — an endless post-auth feedback loop (auth was already done).
 *
 * Fix: getState() returns a stable reference; setState() is a no-op (no new
 * object, no notification) when the patch changes nothing.
 *
 * These tests fail against the pre-fix clone-every-call / always-notify
 * behavior and pass once state identity is stabilized.
 */

import { AuthManager } from '@/lib/auth/core/AuthManager';

function resetSingleton() {
  // @ts-expect-error -- private static field, reset for testing.
  AuthManager.instance = undefined;
}

beforeEach(() => {
  resetSingleton();
});

describe('AuthManager state identity stability', () => {
  it('getState() returns the SAME reference when nothing changed', () => {
    const manager = AuthManager.getInstance();
    const a = manager.getState();
    const b = manager.getState();
    expect(b).toBe(a); // referentially identical, not just deep-equal
  });

  it('setState() with an unchanged value does NOT create a new state object', () => {
    const manager = AuthManager.getInstance();
    const before = manager.getState();

    // isInitialized is already false at construction; setting it to false again
    // must not churn the reference.
    manager.setState({ isInitialized: false });

    expect(manager.getState()).toBe(before);
  });

  it('setState() with an unchanged value does NOT notify listeners', () => {
    const manager = AuthManager.getInstance();
    const listener = jest.fn();
    manager.subscribe(listener);

    // No-op patch: isLoading starts true at construction.
    manager.setState({ isLoading: true });

    expect(listener).not.toHaveBeenCalled();
  });

  it('setState() with a real change DOES create a new object and notify once', () => {
    const manager = AuthManager.getInstance();
    const before = manager.getState();
    const listener = jest.fn();
    manager.subscribe(listener);

    manager.setState({ isConnected: true, address: '0xabc' });

    const after = manager.getState();
    expect(after).not.toBe(before); // new reference on real change
    expect(after.isConnected).toBe(true);
    expect(after.address).toBe('0xabc');
    expect(listener).toHaveBeenCalledTimes(1);
    // And the new reference is stable on subsequent reads.
    expect(manager.getState()).toBe(after);
  });

  it('repeated identical setState calls stay on one stable reference (loop guard)', () => {
    const manager = AuthManager.getInstance();
    manager.setState({ isConnected: true, address: '0xabc' });
    const ref = manager.getState();

    // Simulate the post-auth churn: updateUserData fires setState({isAuthenticated:true})
    // repeatedly; once authenticated, further identical calls must be no-ops.
    manager.setState({ isAuthenticated: true });
    const afterFirstAuth = manager.getState();
    expect(afterFirstAuth).not.toBe(ref); // first one is a real change

    manager.setState({ isAuthenticated: true });
    manager.setState({ isAuthenticated: true });
    expect(manager.getState()).toBe(afterFirstAuth); // no further churn
  });
});
