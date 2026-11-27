import { useState } from 'react';
import Button from '@/components/ui/Button';
import { usePageT } from '@/config/locales';

/**
 * Copying a secret or a command, for the pages that hand a developer one: /api-keys and
 * /myAPIAccessCode. One implementation, so the two look and behave the same.
 */

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = usePageT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  };
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy}>
      {copied ? t('apiKeys.copied') : label ?? t('apiKeys.copy')}
    </Button>
  );
}

export function CodeSample({ children }: { children: string }) {
  return (
    <div className="relative rounded-md border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800 p-4 pr-20 overflow-x-auto">
      <div className="absolute top-3 right-3">
        <CopyButton text={children} />
      </div>
      <pre className="m-0">
        <code className="text-sm font-mono text-secondary-900 dark:text-secondary-100 whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

/** A secret shown once, with a button to copy it. */
export function SecretValue({ value, copyLabel }: { value: string; copyLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 min-w-0 break-all rounded-md border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 font-mono text-sm text-secondary-900 dark:text-white">
        {value}
      </code>
      <CopyButton text={value} label={copyLabel} />
    </div>
  );
}
