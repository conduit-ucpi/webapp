import { apiFetch } from '@/lib/apiFetch';
import React, { useEffect, useRef } from 'react';
import { useAuth } from './SimpleAuthProvider';
import { isValidEmail } from '@/utils/validation';

/**
 * Collects a user's email from their auth provider, silently.
 *
 * ⚠️ THE MANUAL PROMPT IS GONE. This used to fall back to a banner across the top of every
 *    signed-in screen when the provider had no email to give — an interruption on every page,
 *    asking for something optional, from users who had arrived to do something else. The
 *    auto-collection below is the half that was worth keeping: a social or email login already
 *    knows the address, so most users were never the ones being asked.
 *
 *    Anyone who wants notifications and was not auto-collected now has no way to opt in. That
 *    is the deliberate trade — say so rather than let it be discovered.
 *
 * Renders its children untouched; everything it does is a side effect.
 */
export default function EmailPromptManager({ children }: { children: React.ReactNode }) {
  const { user, isLoading, refreshUserData, getProviderUserInfo } = useAuth();
  const hasAttemptedAutoCollect = useRef(false);

  useEffect(() => {
    const autoCollectEmail = async () => {
      // Only try auto-collection if user is authenticated but has no email
      // and we haven't already attempted it
      if (!isLoading && user && !user.email && !hasAttemptedAutoCollect.current) {
        hasAttemptedAutoCollect.current = true;

        console.log('📧 EmailPromptManager: User has no email, attempting auto-collection from provider...');

        // Try to get email from provider (for embedded wallets like Google, Twitter, etc.)
        const providerUserInfo = getProviderUserInfo();

        if (providerUserInfo && providerUserInfo.email && typeof providerUserInfo.email === 'string') {
          const emailFromProvider = providerUserInfo.email;

          console.log('📧 EmailPromptManager: Found email from provider', {
            email: emailFromProvider.substring(0, 3) + '***', // Log partial email for privacy
            authProvider: providerUserInfo.authProvider
          });

          // Validate the email
          if (isValidEmail(emailFromProvider)) {
            console.log('📧 EmailPromptManager: Email is valid, auto-submitting to backend...');

            try {
              const response = await apiFetch('/api/auth/update-email', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: emailFromProvider }),
              });

              if (response.ok) {
                console.log('📧 EmailPromptManager: ✅ Email auto-saved successfully!');

                // Refresh user data to get the updated email
                await refreshUserData();

                // Don't show the prompt - email was saved automatically
                return;
              } else {
                console.error('📧 EmailPromptManager: Failed to auto-save email', {
                  status: response.status
                });
              }
            } catch (error) {
              console.error('📧 EmailPromptManager: Error auto-saving email:', error);
            }
          } else {
            console.warn('📧 EmailPromptManager: Email from provider failed validation', {
              email: emailFromProvider.substring(0, 3) + '***'
            });
          }
        } else {
          console.log('📧 EmailPromptManager: No email available from provider (likely external wallet)');
        }

        // Auto-collection failed. Nothing further to do: there is no prompt to fall back to.
      }
    };

    autoCollectEmail();
    // NOTE: getProviderUserInfo and refreshUserData are intentionally NOT
    // dependencies — both are unstable closures recreated on every auth step,
    // so including them re-runs this effect on every auth change, contributing
    // to the re-render/re-auth churn. The real triggers are user/isLoading; the
    // heavy path is guarded by the hasAttemptedAutoCollect ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);



  return <>{children}</>;
}