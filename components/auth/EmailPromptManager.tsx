import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import EmailCollection from './EmailCollection';

export default function EmailPromptManager({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isConnected, refreshUserData } = useAuth();
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailPromptDismissed, setEmailPromptDismissed] = useState(false);

  // Check if we should show email prompt
  useEffect(() => {
    if (isLoading || !isConnected || !user) {
      setShowEmailPrompt(false);
      return;
    }

    // Only show if user has no email and hasn't dismissed prompt
    const shouldShow = !user.email && !emailPromptDismissed;
    setShowEmailPrompt(shouldShow);
  }, [user, isConnected, isLoading, emailPromptDismissed]);

  const handleEmailSubmit = async (email: string) => {
    try {
      const response = await fetch('/api/auth/update-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update email');
      }

      // Success - hide the prompt
      setShowEmailPrompt(false);
      setEmailPromptDismissed(true);
      
      // Refresh user data to reflect the new email in the current session
      if (refreshUserData) {
        await refreshUserData();
      }
      
    } catch (error) {
      console.error('Failed to update email:', error);
      throw error; // Re-throw so EmailCollection component can handle it
    }
  };

  const handleSkip = () => {
    setShowEmailPrompt(false);
    setEmailPromptDismissed(true);
  };

  return (
    <>
      {showEmailPrompt && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <EmailCollection 
            onEmailSubmit={handleEmailSubmit}
            onSkip={handleSkip}
          />
        </div>
      )}
      {children}
    </>
  );
}