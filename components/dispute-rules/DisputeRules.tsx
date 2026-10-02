import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import RulesMarkdown from '@/components/dispute-rules/RulesMarkdown';
import { PolicyRules } from '@/types/disputeRules';

/**
 * The rules a dispute is decided by, fetched from disputeservice when the page is viewed.
 *
 * Fetched in the browser, not in getStaticProps: baking them in at build would make two builds of
 * the same commit differ whenever the policy had moved between them, which breaks the
 * rebuild-and-compare check (next.config.js generateBuildId), and the static export could only
 * ever show the rules as they stood on the day it was built. The version line is the commit that
 * last changed the policy, so a reader can say exactly which text they were shown.
 */

const SHORT_SHA = 12;

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function VersionLine({ rules }: { rules: PolicyRules }) {
  if (!rules.policySha) {
    return <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">Rules version: unknown.</p>;
  }
  return (
    <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
      Rules version <code title={rules.policySha} data-testid="rules-version">{rules.policySha.slice(0, SHORT_SHA)}</code>
      {rules.policyCommittedAt != null && <>, last changed {formatDate(rules.policyCommittedAt)}</>}
      {rules.policyModified && <> (served from uncommitted changes, so not exactly the text this version names)</>}
      .
    </p>
  );
}

export default function DisputeRules() {
  const [rules, setRules] = useState<PolicyRules | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/dispute-rules')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as PolicyRules;
        if (!cancelled) setRules(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-secondary-600 dark:text-secondary-300" role="alert">
        The current rules could not be loaded just now. Please try again shortly.
      </p>
    );
  }
  if (!rules) {
    return <p className="text-secondary-500 dark:text-secondary-400">Loading the current rules…</p>;
  }
  return (
    <div className="text-secondary-600 dark:text-secondary-300">
      <VersionLine rules={rules} />
      {rules.sections.map((section) => (
        <div key={section.number} className="mb-6" data-testid={`rules-section-${section.number}`}>
          <h3 className="text-xl font-semibold text-secondary-700 dark:text-secondary-200 mb-2">
            §{section.number} {section.title}
          </h3>
          <RulesMarkdown markdown={section.markdown} />
        </div>
      ))}
    </div>
  );
}
