import React from 'react';
import { ToastProvider } from '@/components/ui/Toast';

interface PluginLayoutProps {
  children: React.ReactNode;
}

/**
 * Minimal layout for plugin/iframe embedded pages.
 * No navigation, no header, no footer - just the content.
 * Used for contract-create.tsx when accessed via external plugins.
 */
export default function PluginLayout({ children }: PluginLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider children={children} />
    </div>
  );
}