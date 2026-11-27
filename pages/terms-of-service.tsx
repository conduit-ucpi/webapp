import { lastTextChangeVersion } from '@/lib/server/lastTextChange';
import { TERMS_FILE } from '@/lib/server/gitFileVersion';
import TermsOfServiceDocument from '@/components/legal/TermsOfService';

/**
 * Build-time only. `lastTextChangeVersion` shells out to git, and Next strips
 * getStaticProps and everything it imports from the client bundle — which is
 * what keeps child_process out of the browser. The fallback covers a build with
 * no git history; that path warns.
 *
 * TERMS_FILE is the English text (components/legal/TermsText.tsx), not this page.
 */
export async function getStaticProps() {
  const { date, version } = lastTextChangeVersion(TERMS_FILE, '29 July 2026');
  return { props: { lastUpdated: date, version } };
}

/**
 * `version` is the commit that last changed the terms text — the same value next.config.js puts in
 * TERMS_VERSION, which every SIWE sign-in names when it accepts these terms. Shown so a reader can
 * match the page to what they signed.
 */
export default function TermsOfService({ lastUpdated, version }: { lastUpdated: string; version: string | null }) {
  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <TermsOfServiceDocument lastUpdated={lastUpdated} version={version} />
        </div>
      </div>
    </div>
  );
}
