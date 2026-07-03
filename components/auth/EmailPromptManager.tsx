import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './SimpleAuthProvider';
import EmailCollection from './EmailCollection';
import { isValidEmail } from '../../utils/validation';

// Persisted per-user so a declined prompt stays declined across page loads —
// previously Skip only lived in React state and the prompt re-nagged on every
// navigation.
const SKIP_STORAGE_KEY = 'email-prompt-skipped';

function hasSkippedEmailPrompt(userId: string | undefined): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SKIP_STORAGE_KEY) === (userId || 'anonymous');
  } catch {
    return false;
  }
}

export default function EmailPromptManager({ children }: { children: React.ReactNode }) {
  const { user, isLoading, refreshUserData, getProviderUserInfo } = useAuth();
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAttemptedAutoCollect = useRef(false);

  useEffect(() => {
    const autoCollectEmail = async () => {
      // Only try auto-collection if user is authenticated but has no email
      // and we haven't already attempted it
      if (!isLoading && user && !user.email && !hasAttemptedAutoCollect.current) {
        hasAttemptedAutoCollect.current = true;

        // Try to get email from provider (for embedded wallets like Google, Twitter, etc.)
        const providerUserInfo = getProviderUserInfo();

        if (providerUserInfo && providerUserInfo.email && typeof providerUserInfo.email === 'string') {
          const emailFromProvider = providerUserInfo.email;

          // Validate the email
          if (isValidEmail(emailFromProvider)) {
            try {
              setIsSubmitting(true);

              const response = await fetch('/api/auth/update-email', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: emailFromProvider }),
              });

              if (response.ok) {
                // Refresh user data to get the updated email
                await refreshUserData();

                // Don't show the prompt - email was saved automatically
                setShowEmailPrompt(false);
                return;
              } else {
                console.error('EmailPromptManager: Failed to auto-save email', {
                  status: response.status
                });
              }
            } catch (error) {
              console.error('EmailPromptManager: Error auto-saving email:', error);
            } finally {
              setIsSubmitting(false);
            }
          }
        }

        // Auto-collection failed (likely an external wallet with no provider
        // email) — show the manual prompt unless the user already declined it.
        setShowEmailPrompt(!hasSkippedEmailPrompt(user.userId));
      } else if (!isLoading && user && !user.email) {
        // We've already attempted auto-collection this session.
        setShowEmailPrompt(!hasSkippedEmailPrompt(user.userId));
      } else {
        setShowEmailPrompt(false);
      }
    };

    autoCollectEmail();
    // NOTE: getProviderUserInfo and refreshUserData are intentionally NOT
    // dependencies — both are unstable closures recreated on every auth step,
    // so including them re-runs this effect (and its setShowEmailPrompt calls)
    // on every auth change, contributing to the re-render/re-auth churn. The
    // real triggers are user/isLoading; the heavy path is guarded by the
    // hasAttemptedAutoCollect ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  const handleEmailSubmit = async (email: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/update-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to update email');
      }

      // Email was successfully saved, refresh user data and hide the prompt
      await refreshUserData();
      setShowEmailPrompt(false);
    } catch (error) {
      console.error('Failed to save email:', error);
      throw error; // Re-throw so EmailCollection can show the error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(SKIP_STORAGE_KEY, user?.userId || 'anonymous');
    } catch {
      // Storage unavailable (private mode / embedded) — session-only skip.
    }
    setShowEmailPrompt(false);
  };

  return (
    <>
      {showEmailPrompt && (
        <EmailCollection
          onEmailSubmit={handleEmailSubmit}
          onSkip={handleSkip}
          isLoading={isSubmitting}
        />
      )}
      {children}
    </>
  );
}