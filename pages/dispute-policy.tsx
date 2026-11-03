import SEO from '@/components/SEO'
import { GetStaticProps } from 'next'
import { isr } from '@/utils/isr';
import { lastTextChangeISO } from '@/lib/server/lastTextChange';
import DisputePolicyText, { DISPUTE_POLICY_FILE } from '@/components/legal/DisputePolicyText';
import { useBrand } from '@conduit-ucpi/whitelabel-sdk';

export default function DisputePolicy({ dateModified }: { dateModified: string }) {
  const brand = useBrand().name;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Dispute Policy",
    "description": `How disputes work in a ${brand} protected payment: the contract's three-party voting, how the tiebreaker is appointed and changed, and how ${brand}'s default tiebreaker decides its vote.`,
    "publisher": { "@type": "Organization", "name": brand },
    "dateModified": dateModified
  };

  return (
    <>
      <SEO
        title={`Dispute Policy | ${brand}`}
        description={`How disputes work in a ${brand} protected payment: three-party voting in the contract, how the tiebreaker is appointed and changed, and how ${brand}'s default tiebreaker decides its vote.`}
        keywords="escrow dispute, dispute policy, tiebreaker, USDC escrow, smart contract dispute"
        canonical="/dispute-policy"
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-white dark:bg-secondary-900 py-12 transition-colors">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <DisputePolicyText />
          </div>
        </div>
      </div>
    </>
  )
}

// Static generation for SEO.
//
// `dateModified` comes from git, so it changes only when the policy's text does; see
// lib/server/lastTextChange.ts for why, and for the file-granularity caveat.
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      dateModified: lastTextChangeISO(DISPUTE_POLICY_FILE, '2026-10-03'),
    },
    ...isr(86400), // Revalidate daily
  };
}
