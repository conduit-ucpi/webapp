import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import RulesMarkdown from '@/components/dispute-rules/RulesMarkdown';
import { PolicyRules } from '@/types/disputeRules';
import { useBrand } from '@conduit-ucpi/whitelabel-sdk';

/**
 * The served text names the platform's default brand. The page takes every name from the visitor's
 * brand, so that name is swapped for theirs; nothing else in the text is changed.
 */
export const SERVED_BRAND = 'Stabledrop.me';
export function inBrand(text: string, brand: string): string {
  return text.split(SERVED_BRAND).join(brand);
}

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

/** The served sections' numbers in the Dispute Resolution Rules, which number them differently from the policy file. */
const PUBLIC_NUMBER: Record<string, string> = { '2a': '6.1', '3': '6.2', '4': '6.3', '4a': '6.4' };

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

/**
 * @param only which served sections to show, by their number in the policy file. Default: all.
 * @param bare the sections only: no version line, and no headings, for a section that numbers its own clauses.
 */
export default function DisputeRules({ only, bare = false }: { only?: string[]; bare?: boolean }) {
  const brand = useBrand().name;
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
      {!bare && <VersionLine rules={rules} />}
      {rules.sections.filter((section) => !only || only.includes(section.number)).map((section) => (
        <div key={section.number} className="mb-6" data-testid={`rules-section-${section.number}`}>
          {!bare && (
            <h3 className="text-xl font-semibold text-secondary-700 dark:text-secondary-200 mb-2">
              {PUBLIC_NUMBER[section.number] ?? `§${section.number}`} {inBrand(section.title, brand)}
            </h3>
          )}
          <RulesMarkdown markdown={inBrand(section.markdown, brand)} />
        </div>
      ))}
    </div>
  );
}
