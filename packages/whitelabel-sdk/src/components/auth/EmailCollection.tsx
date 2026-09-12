import React, { useState } from 'react';
import { isValidEmail } from '@/utils/validation';
import { useT } from '../../i18n';

interface EmailCollectionProps {
  onEmailSubmit: (email: string) => Promise<void>;
  onSkip: () => void;
  isLoading?: boolean;
}

export default function EmailCollection({ onEmailSubmit, onSkip, isLoading = false }: EmailCollectionProps) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError(t('emailPrompt.errRequired'));
      return;
    }

    if (!isValidEmail(email)) {
      setError(t('emailPrompt.errInvalid'));
      return;
    }

    setError('');
    setIsSubmitting(true);
    
    try {
      await onEmailSubmit(email.trim());
    } catch (err) {
      setError(t('emailPrompt.errSave'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (!isSubmitting) {
      onSkip();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-800 text-sm">{t('emailCollection.settingUpYourAccount')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="mb-3">
        <h3 className="text-blue-900 font-medium text-sm mb-1">
          {t('emailPrompt.title')}
        </h3>
        <p className="text-blue-700 text-xs">
          {t('emailPrompt.body')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('emailPrompt.placeholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-red-600 text-xs mt-1">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('emailPrompt.saving') : t('emailPrompt.submit')}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-3 py-2 text-blue-600 text-sm font-medium hover:text-blue-800 focus:outline-none disabled:opacity-50"
          >
            {t('emailPrompt.skip')}
          </button>
        </div>
      </form>
    </div>
  );
}