/**
 * Collapsed "Advanced Options" section for contract creation.
 *
 * Extracted from CreateContractWizard so the wizard and the redesigned
 * "Payment Terms" screen share one implementation. Currently holds the
 * optional arbiter override; anything else advanced belongs here too rather
 * than being duplicated per screen.
 *
 * Owns its own open/closed state - no caller has ever needed to control it.
 */

import { useState } from 'react';
import Input from '@/components/ui/Input';

interface AdvancedOptionsProps {
  /** Optional arbiter wallet address override */
  arbiterAddress: string;
  onArbiterChange: (value: string) => void;
  arbiterError?: string;
  className?: string;
}

export default function AdvancedOptions({
  arbiterAddress,
  onArbiterChange,
  arbiterError,
  className = 'border-t border-secondary-200 dark:border-secondary-700 pt-4',
}: AdvancedOptionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setShowAdvanced(prev => !prev)}
        aria-expanded={showAdvanced}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-secondary-700 dark:text-secondary-200 hover:text-secondary-900 dark:hover:text-white focus:outline-none"
      >
        <span>Advanced Options</span>
        <svg
          className={`h-4 w-4 text-secondary-500 dark:text-secondary-400 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showAdvanced && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-secondary-700 dark:text-secondary-200">
              Arbiter Wallet Address
            </label>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200">
              Advanced &middot; Optional
            </span>
          </div>
          <Input
            type="text"
            value={arbiterAddress}
            onChange={(e) => onArbiterChange(e.target.value)}
            placeholder="0x..."
            error={arbiterError}
            helpText="Optional override for the dispute resolver. Leave blank to use the system default."
          />
        </div>
      )}
    </div>
  );
}
