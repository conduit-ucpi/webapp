import { lastTextChange } from '@/lib/server/lastTextChange';
import PrivacyPolicyDocument, { PRIVACY_FILE } from '@/components/legal/PrivacyPolicy';

/**
 * Build-time only; Next strips getStaticProps and its imports from the client
 * bundle. The date is the last change to the policy's English text (PRIVACY_FILE),
 * not to this page. See lib/server/lastTextChange.ts.
 */
export async function getStaticProps() {
  return { props: { lastUpdated: lastTextChange(PRIVACY_FILE, '25 February 2026') } };
}

export default function PrivacyPolicy({ lastUpdated }: { lastUpdated: string }) {
  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <PrivacyPolicyDocument lastUpdated={lastUpdated} />
        </div>
      </div>
    </div>
  );
}
