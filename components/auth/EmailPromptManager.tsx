import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './SimpleAuthProvider';
import EmailCollection from './EmailCollection';
import { isValidEmail } from '../../utils/validation';

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
              setIsSubmitting(true);

              const response = await fetch('/api/auth/update-email', {
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
                setShowEmailPrompt(false);
                return;
              } else {
                console.error('📧 EmailPromptManager: Failed to auto-save email', {
                  status: response.status
                });
              }
            } catch (error) {
              console.error('📧 EmailPromptManager: Error auto-saving email:', error);
            } finally {
              setIsSubmitting(false);
            }
          } else {
            console.warn('📧 EmailPromptManager: Email from provider failed validation', {
              email: emailFromProvider.substring(0, 3) + '***'
            });
          }
        } else {
          console.log('📧 EmailPromptManager: No email available from provider (likely external wallet)');
        }

        // If we get here, auto-collection failed - show the manual prompt
        setShowEmailPrompt(true);
      } else if (!isLoading && user && !user.email) {
        // We've already attempted auto-collection, just show the prompt
        setShowEmailPrompt(true);
      } else {
        setShowEmailPrompt(false);
      }
    };

    autoCollectEmail();
  }, [user, isLoading, getProviderUserInfo, refreshUserData]);

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