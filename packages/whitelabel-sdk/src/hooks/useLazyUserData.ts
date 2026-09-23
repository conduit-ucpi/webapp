import { useEffect, useState } from 'react';

interface UseLazyUserDataParams {
  isConnected: boolean;
  address: string | null | undefined;
  user: unknown | null;
  refreshUserData: (() => Promise<void>) | undefined;
}

/**
 * Lazy-auth one-shot user-data fetch, shared by contract-create and
 * contract-pay. When a wallet is connected (isConnected || address) and there
 * is no user yet, it calls refreshUserData() exactly once — which triggers lazy
 * SIWX auth if no session exists. Failures are swallowed (the caller proceeds
 * without user data).
 *
 * This is a verbatim extraction of the previously inline `fetchUserData`
 * effect. It owns the one-shot guard internally (no caller reads it).
 *
 * IMPORTANT: refreshUserData is intentionally NOT in the effect deps. It is an
 * unstable closure recreated on every auth step (SimpleAuthProvider's authValue
 * memo depends on backendUserData/isLoadingUserData, which flip during the auth
 * flow). Including it re-fires this effect mid-auth → another auth → a
 * re-render/re-auth storm that races the SIWX session rotation and produces
 * perpetual 401s. The primitive guards below already control the one-shot fetch.
 */
export function useLazyUserData(params: UseLazyUserDataParams): void {
  const { isConnected, address, user, refreshUserData } = params;
  const [hasAttemptedUserFetch, setHasAttemptedUserFetch] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      // Only fetch once per session.
      if (hasAttemptedUserFetch) return;
      // Only fetch if wallet is connected.
      if (!isConnected && !address) return;
      // If we already have user data, no need to fetch.
      if (user) return;

      setHasAttemptedUserFetch(true);

      try {
        // Triggers lazy auth automatically if no session exists.
        await refreshUserData?.();
      } catch (error) {
        // If it fails, that's OK — proceed without user data.
        console.log('useLazyUserData: could not load user data, proceeding without it');
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, user, hasAttemptedUserFetch]);
}
