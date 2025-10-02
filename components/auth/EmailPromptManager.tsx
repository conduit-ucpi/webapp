import React from 'react';

// Simplified EmailPromptManager - email collection is now handled elsewhere
export default function EmailPromptManager({ children }: { children: React.ReactNode }) {
  // For now, just pass through the children without any email prompting
  return <>{children}</>;
}