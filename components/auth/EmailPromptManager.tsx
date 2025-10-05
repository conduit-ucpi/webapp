import React, { useState, useEffect } from 'react';
import { useAuth } from './SimpleAuthProvider';
import EmailCollection from './EmailCollection';

export default function EmailPromptManager({ children }: { children: React.ReactNode }) {
  const { user, isLoading, refreshUserData } = useAuth();
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Show email prompt if user is authenticated but has no email
    if (!isLoading && user && !user.email) {
      setShowEmailPrompt(true);
    } else {
      setShowEmailPrompt(false);
    }
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